"""Transactional e-mail over SMTP (e.g. the mailbox that comes with the hosting).

Nothing is sent unless SMTP_HOST is configured. Messages are built with
``email.message.EmailMessage``, which rejects header injection, and every
value interpolated into HTML is escaped.
"""
import logging
import smtplib
import ssl
import threading
from email.message import EmailMessage
from email.utils import formataddr
from html import escape

from flask import current_app

log = logging.getLogger(__name__)

outbox = []  # messages captured in tests (TESTING=True)

BRAND = "Meg'Rooms · Saranda Companion"


def configured():
    cfg = current_app.config
    return bool(cfg.get("TESTING") or cfg.get("SMTP_HOST"))


def _clean(value, limit=200):
    return " ".join(str(value or "").split())[:limit]


def send(to, subject, text, html=None):
    """Send one message. Returns True if it was handed to the mail server."""
    cfg = current_app.config
    sender = cfg.get("SMTP_FROM") or cfg.get("CONTACT_EMAIL")
    msg = EmailMessage()
    msg["From"] = formataddr((BRAND, sender))
    msg["To"] = _clean(to, 255)
    msg["Subject"] = _clean(subject, 150)
    msg["Auto-Submitted"] = "auto-generated"
    msg.set_content(text)
    if html:
        msg.add_alternative(html, subtype="html")

    if cfg.get("TESTING"):
        outbox.append({"to": msg["To"], "subject": msg["Subject"], "text": text})
        return True
    host = cfg.get("SMTP_HOST")
    if not host:
        if not cfg.get("IS_PRODUCTION"):
            # Development convenience only: never log message bodies in production.
            log.info("SMTP not configured; would send to %s:\n%s", msg["To"], text)
        return False
    port = int(cfg.get("SMTP_PORT") or 465)
    context = ssl.create_default_context()
    try:
        if (cfg.get("SMTP_SECURITY") or ("ssl" if port == 465 else "starttls")) == "ssl":
            server = smtplib.SMTP_SSL(host, port, timeout=10, context=context)
        else:
            server = smtplib.SMTP(host, port, timeout=10)
            server.starttls(context=context)
        with server:
            if cfg.get("SMTP_USER"):
                server.login(cfg["SMTP_USER"], cfg.get("SMTP_PASSWORD") or "")
            server.send_message(msg)
        return True
    except (smtplib.SMTPException, OSError) as exc:
        log.warning("mail to %s failed: %s", msg["To"].split("@")[-1], exc.__class__.__name__)
        return False


def _layout(heading, paragraphs, button=None):
    """Small, client-safe HTML e-mail (inline styles, no images, no tracking)."""
    body = "".join(f'<p style="margin:0 0 14px;line-height:1.55">{escape(p)}</p>' for p in paragraphs)
    cta = ""
    if button:
        label, url = button
        cta = (f'<p style="margin:22px 0"><a href="{escape(url, quote=True)}" '
               'style="background:#0e6e86;color:#ffffff;text-decoration:none;padding:12px 22px;'
               f'border-radius:999px;font-weight:700;display:inline-block">{escape(label)}</a></p>'
               f'<p style="margin:0 0 14px;font-size:13px;color:#5b6b73">Or paste this link into your browser:<br>'
               f'<span style="word-break:break-all">{escape(url)}</span></p>')
    return ('<div style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#102028;'
            'max-width:520px;margin:0 auto;padding:24px">'
            f'<h1 style="font-size:22px;margin:0 0 16px">{escape(heading)}</h1>{body}{cta}'
            f'<p style="margin:24px 0 0;font-size:12px;color:#8a989e">{escape(BRAND)} · Sarandë, Albania</p></div>')


def send_action(to, subject, heading, paragraphs, button=None):
    text = "\n\n".join(paragraphs)
    if button:
        text += f"\n\n{button[0]}: {button[1]}"
    return send(to, subject, text + f"\n\n— {BRAND}", _layout(heading, paragraphs, button))


def deliver(fn, *args):
    """Run a mail-sending function off the request thread, so response time
    doesn't reveal whether an address exists and a slow mail server never
    slows a booking down. Runs inline in tests."""
    app = current_app._get_current_object()
    if app.config.get("TESTING"):
        fn(*args)
        return

    def run():
        with app.app_context():
            try:
                fn(*args)
            except Exception:  # pragma: no cover - mail must never break a request
                app.logger.exception("mail delivery failed")
    threading.Thread(target=run, daemon=True).start()


# ---- booking notifications ---------------------------------------------------
def _stay_lines(b):
    return [f"{b['hotel_name']}", f"{b['start_date']} to {b['end_date']} ({b['nights']} nights, {b['guest_count']} guests)",
            f"Total EUR {b['total_cost']:.2f} - reference {b['reference']}"]


def booking_for_host(summary, guest, event):
    """Tell the host something needs their attention. ``summary`` is Booking.to_public_dict()."""
    to = current_app.config.get("CONTACT_EMAIL")
    if not to or not current_app.config.get("SMTP_HOST") and not current_app.config.get("TESTING"):
        return False
    headline = {"requested": "New booking request", "transfer": "Guest says a bank transfer was sent",
                "paid": "Booking paid", "pending": "New booking awaiting payment"}.get(event, "Booking update")
    lines = _stay_lines(summary) + [f"Guest: {_clean(guest.get('name'))} <{_clean(guest.get('email'))}> {_clean(guest.get('phone'))}".strip()]
    if event == "transfer":
        lines.append("Check your bank account, then confirm the booking in the Host desk.")
    return send_action(to, f"{headline}: {summary['reference']}", headline, lines)


def booking_confirmed(summary, email, base):
    paragraphs = ["Your stay is confirmed. We look forward to welcoming you in Sarandë."] + _stay_lines(summary)
    if summary.get("balance_on_arrival"):
        paragraphs.append(f"Balance to pay on arrival: EUR {summary['balance_on_arrival']:.2f}")
    button = ("View your booking", f"{base}/booking/{summary['reference']}") if base else None
    return send_action(email, f"Booking confirmed: {summary['reference']}", "You're booked!", paragraphs, button)
