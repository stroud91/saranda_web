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
    """Can e-mail go out? In development, messages are printed to the server log instead."""
    cfg = current_app.config
    return bool(cfg.get("TESTING") or cfg.get("SMTP_HOST") or not cfg.get("IS_PRODUCTION"))


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


def booking_for_host(summary, guest, event, to=None, base=None):
    """Tell the host something needs their attention. ``summary`` is Booking.to_public_dict().
    ``to`` is a partner business's address when the stay is theirs."""
    partner = bool(to)
    to = to or current_app.config.get("CONTACT_EMAIL")
    if not to or not configured():
        return False
    headline = {"requested": "New booking request", "transfer": "Guest says a bank transfer was sent",
                "paid": "Booking paid", "pending": "New booking awaiting payment"}.get(event, "Booking update")
    lines = _stay_lines(summary) + [f"Guest: {_clean(guest.get('name'))} <{_clean(guest.get('email'))}> {_clean(guest.get('phone'))}".strip()]
    if event == "transfer":
        lines.append("Check your bank account, then confirm the booking in the Host desk.")
    button = None
    if partner:
        lines.append("Confirm or decline it in your business dashboard. The guest pays you directly.")
        button = ("Open your requests", f"{base}/business?tab=requests") if base else None
    return send_action(to, f"{headline}: {summary['reference']}", headline, lines, button)


def _hosted_by(summary):
    host = summary.get("hosted_by")
    return [f"Your host is {_clean(host['name'])}. Payment is arranged directly with them."] if host else []


def booking_confirmed(summary, email, base):
    paragraphs = ["Your stay is confirmed. We look forward to welcoming you."] + _stay_lines(summary) + _hosted_by(summary)
    if summary.get("balance_on_arrival"):
        paragraphs.append(f"Balance to pay on arrival: EUR {summary['balance_on_arrival']:.2f}")
    button = ("View your booking", f"{base}/booking/{summary['reference']}") if base else None
    return send_action(email, f"Booking confirmed: {summary['reference']}", "You're booked!", paragraphs, button)


def booking_cancelled(summary, email, base):
    paragraphs = ["Unfortunately the host couldn't accept this booking, so it has been cancelled. Nothing was charged."] + _stay_lines(summary)
    button = ("Find another stay", f"{base}/stays") if base else None
    return send_action(email, f"Booking cancelled: {summary['reference']}", "Booking cancelled", paragraphs, button)


# ---- reviews -------------------------------------------------------------------
def review_invitation(summary, email, link):
    paragraphs = [f"Thank you for staying at {_clean(summary['hotel_name'])}. We hope you had a good time in Sarandë.",
                  "Would you tell future guests how it was? It takes two minutes, and honest feedback helps us too.",
                  "The link is personal to your stay and works once."]
    return send_action(email, "How was your stay?", "How was your stay?", paragraphs, ("Write a review", link))


def review_received(review, to=None, base=None, partner=False):
    """Tell whoever hosts the stay that a guest reviewed it. ``review`` is Review.to_host_dict()."""
    to = to or current_app.config.get("CONTACT_EMAIL")
    if not to or not configured():
        return False
    lines = [f"{_clean(review['hotel_name'])}: {review['rating']} out of 5 from {_clean(review['author'])}.",
             _clean(review["text"], 600), "It is already public. You can post one public reply."]
    button = None
    if base:
        button = ("Reply in your dashboard", f"{base}/business?tab=reviews") if partner else ("Open the Host desk", f"{base}/account?tab=host")
    return send_action(to, f"New review: {review['rating']}/5 for {_clean(review['hotel_name'], 80)}", "A guest left a review", lines, button)


# ---- partner businesses --------------------------------------------------------
def partner_review_needed(what, name, business_name, base):
    """Tell the site's host that something from a business is waiting for approval."""
    to = current_app.config.get("CONTACT_EMAIL")
    if not to or not configured():
        return False
    lines = [f"{_clean(what)}: {_clean(name)}", f"From: {_clean(business_name)}",
             "It stays hidden from guests until you approve it in the Host desk."]
    button = ("Open the Host desk", f"{base}/account?tab=host") if base else None
    return send_action(to, f"Review needed: {_clean(name, 80)}", "Waiting for your review", lines, button)


def partner_decision(to, name, approved, note, base):
    """Tell a business owner what the host decided about their profile or listing."""
    if not to or not configured():
        return False
    if approved:
        heading, lines = "Approved", [f"“{_clean(name)}” has been approved and is now visible to guests."]
    else:
        heading, lines = "Changes needed", [f"“{_clean(name)}” wasn't approved as submitted."]
        if note:
            lines.append(f"Note from the host: {_clean(note, 600)}")
        lines.append("You can edit it in your business dashboard and it will be reviewed again.")
    button = ("Open your dashboard", f"{base}/business") if base else None
    return send_action(to, f"{heading}: {_clean(name, 80)}", heading, lines, button)


def partner_status(to, business_name, status, note, base):
    """A business was suspended or reinstated by the host."""
    if not to or not configured():
        return False
    if status == "suspended":
        heading = "Your business page was taken offline"
        lines = [f"{_clean(business_name)} and its listings are hidden from guests for now."]
        if note:
            lines.append(f"Note from the host: {_clean(note, 600)}")
    else:
        heading, lines = "Your business page is back online", [f"{_clean(business_name)} and its approved listings are visible again."]
    button = ("Open your dashboard", f"{base}/business") if base else None
    return send_action(to, heading, heading, lines, button)


def enquiry_for_business(to, enquiry, business_name, base):
    """A guest's question. ``enquiry`` is Enquiry.to_owner_dict()."""
    if not to or not configured():
        return False
    when = enquiry.get("start_date") or ""
    if enquiry.get("end_date"):
        when += f" to {enquiry['end_date']}"
    lines = [f"About: {_clean(enquiry['subject'])}",
             f"From: {_clean(enquiry['name'])} <{_clean(enquiry['email'])}> {_clean(enquiry.get('phone'))}".strip()]
    if when or enquiry.get("people"):
        lines.append(" · ".join(x for x in (when, f"{enquiry['people']} people" if enquiry.get("people") else "") if x))
    lines += [_clean(enquiry["message"], 2000), "Reply to the guest directly by email or phone."]
    button = ("Open your requests", f"{base}/business?tab=requests") if base else None
    return send_action(to, f"New question for {_clean(business_name, 60)}: {enquiry['reference']}", "A guest has a question", lines, button)
