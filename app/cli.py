"""Account management from the server's terminal (cPanel → Terminal, inside the app's virtualenv).

    flask users create-host you@example.com     # make a host account (asks for a password)
    flask users promote you@example.com         # turn an existing account into a host
    flask users verify guest@example.com        # mark an address as verified by hand
    flask users list
    flask users cleanup                         # drop expired sessions and tokens
"""
from datetime import timedelta

import click
from flask.cli import AppGroup

from app.models import AuthToken, LoginThrottle, User, UserSession, db
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


@user_commands.command("cleanup")
def cleanup():
    """Delete expired sessions, used or expired tokens and stale sign-in counters."""
    now = utcnow()
    n = UserSession.query.filter(UserSession.expires_at < now).delete(synchronize_session=False)
    n += AuthToken.query.filter(AuthToken.expires_at < now).delete(synchronize_session=False)
    n += LoginThrottle.query.filter(LoginThrottle.window_start < now - timedelta(days=1)).delete(synchronize_session=False)
    db.session.commit()
    click.echo(f"Removed {n} rows.")
