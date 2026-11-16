"""Health checks and alerts: the things that fail quietly on a small site.

``flask monitor check`` (hourly, from cron) looks at the database, the newest
backup, free disk space, imported calendars, outgoing mail, the daily clean-up,
guests left waiting, errors the site ran into and, from outside, whether the
site answers and its certificate is valid. When something needs the host it
sends one e-mail, repeats it once a day while it lasts, and says so when
everything is fine again.

Two more signals:
- an e-mail straight away when the site hits an error it didn't expect, at
  most one every ALERT_ERROR_MINUTES. It names the page and the kind of error
  and never contains what a guest typed;
- ALERT_HEARTBEAT_URL, pinged after every check, so an outside service can
  tell the host when the checks themselves stop running (or mail is down).

What it remembers lives in ``instance/monitor.json``.
"""
import json
import logging
import os
import shutil
import smtplib
import socket
import ssl
import traceback
from contextlib import contextmanager
from datetime import datetime, timedelta, timezone
from urllib.parse import urlparse

import requests
from flask import current_app, request

from app.models import Booking, CalendarFeed, Hotel, db
from app.models.db import utcnow
from app.services import backups, mailer

try:
    import fcntl
except ImportError:  # Windows (development only)
    fcntl = None

log = logging.getLogger(__name__)
APP_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))  # …/app
ROOT = os.path.dirname(APP_DIR)


def _cfg(name, default=None):
    return current_app.config.get(name, default)


def _iso(when):
    return when.replace(microsecond=0).isoformat()


def _when(text):
    try:
        return datetime.fromisoformat(text) if text else None
    except (TypeError, ValueError):
        return None


def _day(when):
    return f"{when.day} {when.strftime('%b %Y, %H:%M')} UTC"


# ---- memory --------------------------------------------------------------------
@contextmanager
def _state():
    """Read, change and save the notes as one step, also when several workers do it at once."""
    path = _cfg("MONITOR_FILE") or os.path.join(current_app.instance_path, "monitor.json")
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path + ".lock", "w") as lock:
        if fcntl:
            fcntl.flock(lock, fcntl.LOCK_EX)
        try:
            with open(path, encoding="utf-8") as fh:
                data = json.load(fh)
            data = data if isinstance(data, dict) else {}
        except (OSError, ValueError):
            data = {}
        yield data
        with open(os.open(path + ".part", os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600), "w", encoding="utf-8") as fh:
            json.dump(data, fh)
        os.replace(path + ".part", path)


def recall():
    with _state() as data:
        return dict(data)


def mark(job):
    """Note that a scheduled job ran (the check warns when one stops)."""
    with _state() as data:
        data.setdefault("jobs", {})[job] = _iso(utcnow())


def recipient():
    """Where alerts go: ALERT_EMAIL, or the address that already gets the booking e-mails."""
    return _cfg("ALERT_EMAIL") or _cfg("CONTACT_EMAIL")


def _host_desk():
    base = (_cfg("PUBLIC_BASE_URL") or "").rstrip("/")
    return ("Open the Host desk", f"{base}/account?tab=host") if base else None


# ---- errors the site didn't expect ----------------------------------------------
def record_error(exc):
    """Count an unexpected error and, at most once every ALERT_ERROR_MINUTES, e-mail the host.
    Kept: the kind of error, the page's address pattern and the line of code. Never the
    error's own text or anything from the request, which could hold a guest's details."""
    try:
        rule = request.url_rule.rule if request and request.url_rule else "(unknown address)"
        where = f"{request.method} {rule}"[:120]
        spot = ""
        for frame in reversed(traceback.extract_tb(exc.__traceback__)):
            if frame.filename.startswith(APP_DIR + os.sep):
                spot = f"{os.path.relpath(frame.filename, ROOT)}:{frame.lineno} in {frame.name}"
                break
        now = utcnow()
        sample = {"at": _iso(now), "where": where, "what": exc.__class__.__name__, "spot": spot}
        with _state() as data:
            errors = data.setdefault("errors", {"count": 0, "since": _iso(now), "samples": []})
            errors["count"] += 1
            errors["samples"] = (errors["samples"] + [sample])[-5:]
            last = _when(data.get("error_mail_at"))
            due = not last or now - last >= timedelta(minutes=int(_cfg("ALERT_ERROR_MINUTES", 60)))
            if due:
                data["error_mail_at"] = _iso(now)
                held, data["errors_unmailed"] = data.get("errors_unmailed", 0), 0
            else:
                data["errors_unmailed"] = data.get("errors_unmailed", 0) + 1
        if due and recipient():
            lines = [f"The site ran into an error it didn't expect: {sample['what']} at {where}.",
                     f"In the code: {spot}." if spot else "It happened outside the site's own code.",
                     "The visitor saw “Something went wrong on our side”. The full details are in the server's error log (cPanel → Setup Python App → your app's log file)."]
            if held:
                lines.append(f"{held} more happened since the last e-mail like this one.")
            lines.append(f"To keep your inbox usable you get at most one of these every {int(_cfg('ALERT_ERROR_MINUTES', 60))} minutes.")
            mailer.deliver(mailer.send_action, recipient(), f"Site error: {sample['what']} at {where}", "The site hit an error", lines, _host_desk())
    except Exception:  # noting an error must never cause another one
        log.exception("could not record an error")


# ---- the checks --------------------------------------------------------------------
def _problem(key, message, level="problem"):
    return {"key": key, "level": level, "message": message}


def _migration_head():
    try:
        from alembic.script import ScriptDirectory
        return ScriptDirectory(os.path.join(ROOT, "migrations")).get_current_head()
    except Exception:
        return None


def _check_backups(now):
    notes = backups.state()
    last = backups.latest("data")
    failed, good = notes.get("last_error") or {}, _when(notes.get("last_ok"))
    failed_at = _when(failed.get("at"))
    if failed_at and (not good or failed_at > good):
        return _problem("backup", f"The last backup failed ({_day(failed_at)}): {failed.get('message', '')}")
    if not last:
        return _problem("backup", "No backup has been made yet. Add the daily `flask backup run` cron job (docs/GO-LIVE.md, step 11).")
    limit = int(_cfg("BACKUP_MAX_AGE_HOURS", 36))
    if now - last["at"] > timedelta(hours=limit):
        return _problem("backup", f"The newest backup is from {_day(last['at'])}. The daily backup job seems to have stopped.")
    return None


def _check_calendars(now):
    found = []
    limit = now - timedelta(hours=int(_cfg("ALERT_CALENDAR_HOURS", 24)))
    for feed in CalendarFeed.query.all():
        seen = feed.last_ok_at or feed.created_at
        if seen and seen < limit:
            stay = db.session.get(Hotel, feed.hotel_id)
            why = f" Last answer: {feed.last_error}." if feed.last_error else " Is the `flask calendars sync` cron job still running?"
            found.append(_problem(f"calendar:{feed.id}", f"The calendar “{feed.name}” of {stay.hotel_name if stay else 'a stay'} hasn't been read since "
                                  f"{_day(seen)}.{why} Nights booked on that site may show as free here."))
    return found


def _check_mail(deep):
    if not _cfg("SMTP_HOST"):
        return _problem("mail", "Outgoing e-mail isn't set up (SMTP_HOST), so guests get no confirmations and you get no alerts.") if _cfg("IS_PRODUCTION") else None
    if not deep:
        return None
    port = int(_cfg("SMTP_PORT") or 465)
    try:
        context = ssl.create_default_context()
        if (_cfg("SMTP_SECURITY") or ("ssl" if port == 465 else "starttls")) == "ssl":
            server = smtplib.SMTP_SSL(_cfg("SMTP_HOST"), port, timeout=10, context=context)
        else:
            server = smtplib.SMTP(_cfg("SMTP_HOST"), port, timeout=10)
            server.starttls(context=context)
        with server:
            if _cfg("SMTP_USER"):
                server.login(_cfg("SMTP_USER"), _cfg("SMTP_PASSWORD") or "")
    except (smtplib.SMTPException, OSError) as exc:
        return _problem("mail", f"The mail server refused the site ({exc.__class__.__name__}). Check SMTP_USER and SMTP_PASSWORD: guests aren't getting e-mails.")
    return None


def _check_site():
    """From outside: does the site answer, and how long is its certificate still valid?"""
    base = (_cfg("PUBLIC_BASE_URL") or "").rstrip("/")
    host = urlparse(base).hostname
    if not (_cfg("IS_PRODUCTION") and base.startswith("https://") and host):
        return []
    found = []
    try:
        answer = requests.get(f"{base}/api/meta/health", timeout=15, allow_redirects=False, headers={"User-Agent": "SarandaCompanion-monitor/1"})
        if answer.status_code != 200:
            found.append(_problem("site", f"The site answered {answer.status_code} at {base}. Restart the app in cPanel → Setup Python App."))
    except requests.exceptions.SSLError:
        found.append(_problem("certificate", f"The security certificate of {host} is not valid: browsers are warning visitors away. Run cPanel → SSL/TLS Status → AutoSSL."))
        return found
    except requests.RequestException as exc:
        found.append(_problem("site", f"The site didn't answer at {base} ({exc.__class__.__name__})."))
        return found
    try:
        with socket.create_connection((host, 443), timeout=10) as sock, ssl.create_default_context().wrap_socket(sock, server_hostname=host) as tls:
            ends = datetime.fromtimestamp(ssl.cert_time_to_seconds(tls.getpeercert()["notAfter"]), timezone.utc).replace(tzinfo=None)
        left = (ends - utcnow()).days
        if left < int(_cfg("ALERT_CERT_DAYS", 10)):
            found.append(_problem("certificate", f"The security certificate of {host} runs out in {left} days and hasn't renewed itself. Run cPanel → SSL/TLS Status → AutoSSL."))
    except (OSError, ValueError, KeyError):
        pass  # the request above already proved the certificate is accepted
    return found


def _check_waiting(now):
    found = []
    house = Booking.query.join(Hotel, Booking.hotel_id == Hotel.id).filter(Hotel.business_id.is_(None))
    waiting = house.filter(Booking.status == "requested", Booking.created_at < now - timedelta(hours=24)).count()
    if waiting:
        found.append(_problem("waiting", f"{waiting} booking request{'s have' if waiting != 1 else ' has'} waited more than a day for your answer.", "reminder"))
    owed = house.filter(Booking.refund_status == "due", Booking.cancelled_at < now - timedelta(days=3)).count()
    if owed:
        found.append(_problem("refunds", f"{owed} refund{'s are' if owed != 1 else ' is'} still to be paid back after more than three days.", "reminder"))
    return found


def checks(deep=False, now=None):
    """Everything that needs the host right now, as [{"key", "level", "message"}].
    ``deep`` adds the checks that reach out over the network (mail server, the public site)."""
    now = now or utcnow()
    try:
        db.session.execute(db.text("SELECT 1"))
    except Exception as exc:
        db.session.rollback()
        return [_problem("database", f"The database can't be reached ({exc.__class__.__name__}). The site can't take bookings.")]
    found = []
    current, head = backups._migration(), _migration_head()
    if current and head and current != head:
        found.append(_problem("migration", "The database is older than the code. Run `flask db upgrade`, then restart the app."))
    found.append(_check_backups(now))
    try:
        free = shutil.disk_usage(current_app.instance_path).free // (1024 * 1024)
        if free < int(_cfg("ALERT_MIN_FREE_MB", 500)):
            found.append(_problem("disk", f"Only {free} MB of disk space is left. Photos and backups will start to fail: delete old files or enlarge the plan."))
    except OSError:
        pass
    found += _check_calendars(now)
    found.append(_check_mail(deep))
    notes = recall()
    cleaned = _when((notes.get("jobs") or {}).get("cleanup"))
    if _cfg("IS_PRODUCTION") and (not cleaned or now - cleaned > timedelta(hours=36)):
        found.append(_problem("cleanup", "The daily clean-up (`flask users cleanup`) " + (f"hasn't run since {_day(cleaned)}." if cleaned else "has never run.")
                              + " Check its cron job: it also sends review invitations and deletes old data as the privacy policy promises."))
    errors = notes.get("errors") or {}
    if errors.get("count"):
        kinds = sorted({f"{s['what']} at {s['where']}" for s in errors.get("samples", [])})
        found.append(_problem("errors", f"The site ran into {errors['count']} unexpected error{'s' if errors['count'] != 1 else ''} since "
                              f"{_day(_when(errors.get('since')) or now)}: {'; '.join(kinds)[:400]}. Details are in the server's error log."))
    found += _check_waiting(now)
    if deep:
        found += _check_site()
    return [item for item in found if item]


def facts():
    """Numbers for the Host desk's health line."""
    last = backups.latest("data")
    rows = backups.listing()
    try:
        free = shutil.disk_usage(current_app.instance_path).free // (1024 * 1024)
    except OSError:
        free = None
    try:
        offsite = bool(backups.offsite())
    except backups.BackupError:
        offsite = False
    return {"backup": {"at": _iso(last["at"]) + "Z", "bytes": last["bytes"], "encrypted": last["encrypted"]} if last else None,
            "backups_kept": len(rows), "backups_bytes": sum(r["bytes"] for r in rows), "offsite": offsite, "disk_free_mb": free,
            "last_check": (recall().get("checked_at") or None)}


# ---- telling the host ------------------------------------------------------------------
def notify(found, now=None):
    """E-mail the host when something new needs them, once a day while it lasts, and once
    more when all is well again. Returns "alert", "clear" or None (nothing sent)."""
    now = now or utcnow()
    repeat = timedelta(hours=int(_cfg("ALERT_REPEAT_HOURS", 24)))
    with _state() as data:
        open_before = data.get("open") or {}
        keys = {item["key"] for item in found}
        new = keys - set(open_before)
        mailed = _when(data.get("alert_mail_at"))
        action = None
        if found and (new or not mailed or now - mailed >= repeat):
            action, data["alert_mail_at"] = "alert", _iso(now)
        elif not found and open_before:
            action, data["alert_mail_at"] = "clear", None
        data["open"] = {key: open_before.get(key, _iso(now)) for key in keys}
        data["checked_at"] = _iso(now) + "Z"
        if any(item["key"] == "errors" for item in found):
            data["errors"] = {"count": 0, "since": _iso(now), "samples": []}  # reported; start counting afresh
            data["open"].pop("errors", None)
    to = recipient()
    if not (action and to):
        return None
    if action == "clear":
        mailer.send_action(to, "Site check: all clear", "Everything is fine again", ["The problems reported earlier are solved. Nothing needs you right now."], _host_desk())
        return action
    urgent = [item["message"] for item in found if item["level"] == "problem"]
    gentle = [item["message"] for item in found if item["level"] != "problem"]
    count = len(found)
    lines = [f"• {text}" for text in urgent] + ([("Also waiting for you:" if urgent else "Waiting for you:")] + [f"• {text}" for text in gentle] if gentle else [])
    lines.append("You'll get this again tomorrow if it still needs you, and a short note when all is fine.")
    mailer.send_action(to, f"Site check: {count} thing{'s need' if count != 1 else ' needs'} you", "Your site needs you", lines, _host_desk())
    return action


def heartbeat(ok):
    """Tell an outside watcher (healthchecks.io style) that the check ran: the address as it
    is when all is well, with /fail added when something needs the host."""
    url = (_cfg("ALERT_HEARTBEAT_URL") or "").strip().rstrip("/")
    if not url.startswith("https://"):
        return False
    try:
        requests.get(url if ok else url + "/fail", timeout=10, allow_redirects=False, headers={"User-Agent": "SarandaCompanion-monitor/1"})
        return True
    except requests.RequestException as exc:
        log.warning("heartbeat failed: %s", exc.__class__.__name__)
        return False


def run(deep=True):
    """One full round: check, e-mail if needed, ping the heartbeat. Returns (found, action)."""
    found = checks(deep=deep)
    action = notify(found)
    heartbeat(not [item for item in found if item["level"] == "problem"])
    return found, action
