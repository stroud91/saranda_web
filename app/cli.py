"""Account management from the server's terminal (cPanel → Terminal, inside the app's virtualenv).

    flask users create-host you@example.com     # make a host account (asks for a password)
    flask users promote you@example.com         # turn an existing account into a host
    flask users verify guest@example.com        # mark an address as verified by hand
    flask users list
    flask users cleanup                         # drop expired sessions/tokens and old messages (run daily)

Looking after the site:

    flask backup run                            # back up the database and photos (run daily)
    flask backup list | verify | restore | extract
    flask monitor check                         # look for problems and e-mail the host (run hourly)
    flask monitor test                          # send a test alert
"""
from datetime import timedelta

import click
from flask import current_app
from flask.cli import AppGroup

from app.models import AuthToken, ContactMessage, Enquiry, GuideBooking, LoginThrottle, User, UserSession, db
from app.services import backups, calendars, mailer, monitor, reviews, stats, twofactor, uploads
from app.models.db import utcnow
from app.services import accounts

user_commands = AppGroup("users", help="Manage guest and host accounts.")


def _find(email):
    user = User.query.filter_by(email=email.strip().lower()).first()
    if not user:
        raise click.ClickException(f"No account for {email}")
    return user


@user_commands.command("create-host")
@click.argument("email")
@click.option("--name", default="Host")
@click.password_option(help="Password (asked for twice if omitted).")
def create_host(email, name, password):
    """Create a verified host (admin) account."""
    email = email.strip().lower()
    if User.query.filter_by(email=email).first():
        raise click.ClickException("That address already has an account. Use: flask users promote")
    problem = accounts.password_problem(password, email, name)
    if problem:
        raise click.ClickException(problem)
    user = User(username=email, email=email, name=name, role="admin")
    user.set_password(password)
    user.mark_verified()
    db.session.add(user)
    db.session.commit()
    click.echo(f"Host account created for {email}. Sign in on the site to open the Host desk.")


@user_commands.command("promote")
@click.argument("email")
def promote(email):
    """Give an existing account host (admin) rights."""
    user = _find(email)
    user.role = "admin"
    user.mark_verified()
    accounts.revoke_sessions(user)  # host sessions are shorter; sign in again
    db.session.commit()
    click.echo(f"{user.email} is now a host. Sign in again to see the Host desk.")


@user_commands.command("demote")
@click.argument("email")
def demote(email):
    """Remove host rights."""
    user = _find(email)
    user.role = "guest"
    accounts.revoke_sessions(user)
    db.session.commit()
    click.echo(f"{user.email} is a guest account again.")


@user_commands.command("verify")
@click.argument("email")
def verify(email):
    """Mark an account's e-mail address as verified."""
    user = _find(email)
    user.mark_verified()
    db.session.commit()
    click.echo(f"{user.email} verified.")


@user_commands.command("list")
def list_users():
    for u in User.query.order_by(User.created_at).limit(500):
        flags = ", ".join(f for f, on in (("host", u.is_admin), ("verified", u.email_verified)) if on)
        click.echo(f"{u.id:>4}  {u.email:<40} {u.name or '':<24} {flags}")


@user_commands.command("disable-two-step")
@click.argument("email")
def disable_two_step(email):
    """Switch two-step sign-in off for an account that lost its phone and its recovery codes.
    Only run this when you are sure who is asking. Every device is signed out."""
    user = _find(email)
    twofactor.switch_off(user)
    accounts.revoke_sessions(user)
    db.session.commit()
    click.echo(f"Two-step sign-in is off for {user.email}. They can sign in with their password and set it up again.")


@user_commands.command("cleanup")
def cleanup():
    """Delete expired sessions, used or expired tokens and stale sign-in counters, plus
    contact messages, enquiries to partner businesses and unconfirmed guide requests older
    than MESSAGE_RETENTION_MONTHS."""
    now = utcnow()
    n = UserSession.query.filter(UserSession.expires_at < now).delete(synchronize_session=False)
    n += AuthToken.query.filter(AuthToken.expires_at < now).delete(synchronize_session=False)
    n += LoginThrottle.query.filter(LoginThrottle.window_start < now - timedelta(days=1)).delete(synchronize_session=False)
    months = current_app.config.get("MESSAGE_RETENTION_MONTHS", 24)
    if months > 0:
        cutoff = now - timedelta(days=round(months * 30.44))
        n += ContactMessage.query.filter(ContactMessage.created_at < cutoff).delete(synchronize_session=False)
        n += Enquiry.query.filter(Enquiry.created_at < cutoff).delete(synchronize_session=False)
        # Accepted guide requests are business records and are kept like stay bookings.
        n += GuideBooking.query.filter(GuideBooking.status != "accepted",
                                       GuideBooking.created_at < cutoff).delete(synchronize_session=False)
    db.session.commit()
    n += uploads.cleanup()  # photos that were uploaded but never used
    n += stats.cleanup()  # yesterday's one-day visitor codes, and very old counters
    invited = reviews.send_invitations()  # guests who checked out yesterday are asked for a review
    monitor.mark("cleanup")
    click.echo(f"Removed {n} rows." + (f" Sent {invited} review invitations." if invited else ""))


calendar_commands = AppGroup("calendars", help="Calendars imported from other booking sites.")


@calendar_commands.command("sync")
def sync_calendars():
    """Re-read every connected calendar (run this from cron every 30 minutes)."""
    ok, total = calendars.sync_all()
    monitor.mark("calendars")
    click.echo(f"Synced {ok} of {total} calendars.")


backup_commands = AppGroup("backup", help="Backups of the database and the uploaded photos.")


def _size(n):
    return f"{n / 1048576:.1f} MB" if n >= 1048576 else f"{max(1, n // 1024)} KB"


def _backup_error(exc):
    return click.ClickException(str(exc))


@backup_commands.command("run")
@click.option("--photos/--no-photos", default=None, help="Include the photos now, or leave them out. Default: when they changed, at most weekly.")
def backup_run(photos):
    """Back up the database (and the photos when due), thin out old backups and send
    new ones to BACKUP_UPLOAD_URL. Run this daily from cron."""
    try:
        done = backups.run(photos=photos)
    except backups.BackupError as exc:
        raise _backup_error(exc)
    click.echo("Made " + ", ".join(done["made"]) + (f". Removed {len(done['removed'])} old." if done["removed"] else ".")
               + (f" Sent {len(done['sent'])} to the backup server." if done["sent"] else ""))
    if not current_app.config.get("BACKUP_UPLOAD_URL"):
        click.echo("Note: these backups live on this server only. Download them now and then, or set BACKUP_UPLOAD_URL.")


@backup_commands.command("list")
def backup_list():
    """Backups on this server, newest first."""
    rows = backups.listing()
    for row in rows:
        click.echo(f"{row['name']:<44} {_size(row['bytes']):>10}  {'encrypted' if row['encrypted'] else 'not encrypted'}")
    click.echo(f"{len(rows)} backups in {backups.folder()}")


@backup_commands.command("verify")
@click.argument("name", required=False)
def backup_verify(name):
    """Open a backup (the newest if none is named) and check that it can be restored."""
    try:
        m = backups.verify(name)
    except backups.BackupError as exc:
        raise _backup_error(exc)
    if m.get("kind") == "photos":
        click.echo(f"{m['name']} is good: {m['files']} photos, made {m['created']}.")
    else:
        rows = m.get("rows") or {}
        click.echo(f"{m['name']} is good: made {m['created']}, {rows.get('bookings', 0)} bookings, {rows.get('accounts', 0)} accounts, {rows.get('stays', 0)} stays.")


@backup_commands.command("extract")
@click.argument("name")
@click.argument("folder", type=click.Path(file_okay=False))
def backup_extract(name, folder):
    """Unpack a backup into a new folder, to look at it or restore by hand."""
    try:
        backups.extract(name, folder)
    except backups.BackupError as exc:
        raise _backup_error(exc)
    click.echo(f"Unpacked into {folder}. It holds guests' personal details: delete the folder when you're done.")


@backup_commands.command("restore")
@click.argument("name")
@click.option("--yes", is_flag=True, help="Don't ask for confirmation.")
def backup_restore(name, yes):
    """Put a backup back. A data backup REPLACES the whole database with the one in the
    backup (the current one is backed up first). A photos backup only adds missing photos."""
    if name.startswith("data-") and not yes:
        click.confirm("This replaces every booking, account and listing with the ones in the backup. Continue?", abort=True)
    try:
        m = backups.restore(name)
    except backups.BackupError as exc:
        raise _backup_error(exc)
    if m.get("kind") == "photos":
        click.echo(f"Copied back {m['restored']} missing photos.")
    else:
        click.echo(f"Database restored from {m['name']} (made {m['created']}). What was there before is saved as {m['safety']}.\n"
                   "Now run `flask db upgrade` and restart the app (cPanel → Setup Python App → Restart).")


monitor_commands = AppGroup("monitor", help="Health checks and alerts for the host.")


@monitor_commands.command("check")
@click.option("--quiet", is_flag=True, help="Print nothing when all is well (for cron).")
@click.option("--local", is_flag=True, help="Skip the checks that use the network (mail server, the public site).")
def monitor_check(quiet, local):
    """Look for problems, e-mail the host about new ones and ping the heartbeat address.
    Run this hourly from cron. Exits with 1 when something is wrong."""
    found, action = monitor.run(deep=not local)
    for item in found:
        click.echo(f"{'!!' if item['level'] == 'problem' else ' -'} {item['message']}")
    if not found and not quiet:
        click.echo("All good: nothing needs you.")
    if action:
        click.echo(f"E-mail sent to {monitor.recipient()}." if action == "alert" else "All-clear e-mail sent.")
    if any(item["level"] == "problem" for item in found):
        raise SystemExit(1)


@monitor_commands.command("test")
def monitor_test():
    """Send a test alert, to see that alerts reach you."""
    to = monitor.recipient()
    if not to:
        raise click.ClickException("No address to send to: set ALERT_EMAIL.")
    sent = mailer.send_action(to, "Site check: test alert", "Alerts are working",
                              ["This is a test. When the hourly check finds a problem (a failed backup, a calendar that stopped updating, "
                               "a full disk, an error on the site), you'll get an e-mail like this one."])
    click.echo(f"Test alert sent to {to}." if sent else "The e-mail could not be sent: check the SMTP settings in .env.")
    if current_app.config.get("ALERT_HEARTBEAT_URL"):
        click.echo("Heartbeat pinged." if monitor.heartbeat(True) else "The heartbeat address could not be reached (it must start with https://).")
