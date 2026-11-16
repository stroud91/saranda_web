"""Calendars for stays: nights blocked by hand, nights imported from other
booking sites (iCal), and the feed this site offers them in return.

Fetching a web address that a user typed is the classic way into a server's
private network (SSRF), so feeds are only ever fetched from the booking sites
listed below (plus any hosts the operator adds), over HTTPS, without following
redirects, with a time limit and a size limit. What comes back is treated as
untrusted text: only dates are read from it.
"""
import logging
import re
import time
from datetime import date, datetime, timedelta
from urllib.parse import urlparse

import requests
from flask import current_app

from app.models import Booking, CalendarFeed, DateBlock, Hotel, db
from app.models.booking import ACTIVE_STATUSES
from app.models.calendar import new_calendar_token
from app.models.db import utcnow

log = logging.getLogger(__name__)

# Calendar hosts of the booking sites and calendars hosts commonly use.
FEED_HOST_SUFFIXES = ("airbnb.com", "booking.com", "vrbo.com", "homeaway.com", "tripadvisor.com", "calendar.google.com")
AIRBNB_REGIONAL = re.compile(r"^(www\.)?airbnb\.[a-z]{2,3}(\.[a-z]{2})?$")  # airbnb.it, airbnb.co.uk…
MAX_FEED_BYTES = 1_500_000
MAX_EVENTS = 3000
MAX_EVENT_NIGHTS = 400
HORIZON_DAYS = 800
TIMEOUT = (3.05, 8)
TIMEOUT_QUICK = (2, 4)  # while a guest waits for their booking to go through
MAX_FEEDS_PER_STAY = 6


class FeedError(Exception):
    """A problem worth showing to the host, in plain words."""


def _extra_hosts():
    return tuple(h.strip().lower() for h in current_app.config.get("CALENDAR_FEED_HOSTS", []) if h.strip())


def feed_host_allowed(url):
    """HTTPS links to a known calendar host only; nothing with a port, login or IP address."""
    try:
        parsed = urlparse(url)
        host = (parsed.hostname or "").lower()
        port = parsed.port
    except ValueError:
        return False
    if parsed.scheme != "https" or not host or port not in (None, 443) or parsed.username or parsed.password:
        return False
    if ":" in host or re.fullmatch(r"\d{1,3}(\.\d{1,3}){3}", host):  # IPv6 or IPv4 literal
        return False
    if AIRBNB_REGIONAL.match(host):
        return True
    return any(host == s or host.endswith("." + s) for s in FEED_HOST_SUFFIXES + _extra_hosts())


def fetch(url, timeout=TIMEOUT):
    if not feed_host_allowed(url):
        raise FeedError("That calendar link isn't from a booking site we can read")
    try:
        with requests.get(url, headers={"User-Agent": "SarandaCompanion-Calendar/1.0", "Accept": "text/calendar, text/plain"},
                          timeout=timeout, stream=True, allow_redirects=False) as resp:
            if resp.status_code != 200:
                raise FeedError(f"The calendar link answered with an error ({resp.status_code})")
            body = resp.raw.read(MAX_FEED_BYTES + 1, decode_content=True)
    except requests.RequestException:
        raise FeedError("The calendar link couldn't be reached") from None
    if len(body) > MAX_FEED_BYTES:
        raise FeedError("That calendar is too large to read")
    return body.decode("utf-8", errors="replace")


# ---- reading iCal ------------------------------------------------------------
_DATE = re.compile(r"^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})Z?)?$")


def _when(value):
    """(date, has_time, is_midnight) from an iCal date or date-time; None if it isn't one."""
    m = _DATE.match(value.strip())
    if not m:
        return None
    try:
        day = date(int(m.group(1)), int(m.group(2)), int(m.group(3)))
    except ValueError:
        return None
    return day, m.group(4) is not None, m.group(4) in (None, "00") and m.group(5) in (None, "00")


def parse_ics(text, today=None):
    """Busy date ranges ``[(start, end)]`` from an iCal file, ``end`` being the first free day.

    Only DTSTART/DTEND are read. Past events, cancelled events and anything
    implausibly long are dropped, and the number of events is capped.
    """
    today = today or date.today()
    horizon = today + timedelta(days=HORIZON_DAYS)
    if "BEGIN:VCALENDAR" not in text[:2000].upper():
        raise FeedError("That link didn't return a calendar")
    lines = re.sub(r"\r?\n[ \t]", "", text).splitlines()  # unfold continuation lines
    out, event, seen = [], None, 0
    for raw in lines:
        line = raw.strip()
        upper = line.upper()
        if upper == "BEGIN:VEVENT":
            event = {}
            seen += 1
            if seen > MAX_EVENTS:
                break
        elif upper == "END:VEVENT":
            if event and event.get("start") and event.get("status") != "CANCELLED":
                start, _, _ = event["start"]
                # An end like "10:00 on the 14th" means the 14th is free again, as with a plain date.
                end = event["end"][0] if event.get("end") else start + timedelta(days=1)
                if end <= start:
                    end = start + timedelta(days=1)
                if (end - start).days <= MAX_EVENT_NIGHTS and end > today and start < horizon:
                    out.append((max(start, today), min(end, horizon)))
            event = None
        elif event is not None and ":" in line:
            head, value = line.split(":", 1)
            name = head.split(";", 1)[0].upper()
            if name == "DTSTART":
                event["start"] = _when(value)
            elif name == "DTEND":
                event["end"] = _when(value)
            elif name == "STATUS":
                event["status"] = value.strip().upper()
    return sorted(set(out))


# ---- syncing -----------------------------------------------------------------
def sync_feed(feed, timeout=TIMEOUT):
    """Replace the feed's imported blocks with what the feed says now. Never raises."""
    feed.last_synced_at = utcnow()
    try:
        ranges = parse_ics(fetch(feed.url, timeout))
    except FeedError as exc:
        feed.last_error = str(exc)[:200]
        db.session.commit()
        return False
    except Exception:  # pragma: no cover - a broken feed must never break a booking
        log.exception("calendar feed %s failed", feed.id)
        feed.last_error = "The calendar couldn't be read"
        db.session.commit()
        return False
    DateBlock.query.filter_by(feed_id=feed.id).delete(synchronize_session=False)
    db.session.add_all([DateBlock(hotel_id=feed.hotel_id, feed_id=feed.id, start_date=s, end_date=e) for s, e in ranges])
    feed.events, feed.last_error, feed.last_ok_at = len(ranges), None, feed.last_synced_at
    db.session.commit()
    return True


def sync_stay(hotel_id, older_than_minutes=0, budget_seconds=None):
    """Sync a stay's feeds that haven't been tried for a while. Returns how many were synced.

    ``budget_seconds`` is for the booking path, where a guest is waiting: slow sites get a
    shorter time limit, and once the budget is spent the rest are left for the next cron run.
    """
    cutoff = utcnow() - timedelta(minutes=older_than_minutes)
    started, n = time.monotonic(), 0
    for feed in CalendarFeed.query.filter_by(hotel_id=hotel_id).order_by(CalendarFeed.last_synced_at).all():
        if older_than_minutes and feed.last_synced_at and feed.last_synced_at > cutoff:
            continue
        if budget_seconds is not None and time.monotonic() - started > budget_seconds:
            break
        sync_feed(feed, TIMEOUT_QUICK if budget_seconds is not None else TIMEOUT)
        n += 1
    return n


def sync_all():
    feeds = CalendarFeed.query.order_by(CalendarFeed.last_synced_at.is_(None).desc(), CalendarFeed.last_synced_at).all()
    ok = sum(1 for feed in feeds if sync_feed(feed))
    return ok, len(feeds)


# ---- availability ------------------------------------------------------------
def blocks_between(hotel_id, start, end):
    """Blocks touching the nights from ``start`` up to (not including) ``end``. Dates, not datetimes."""
    return DateBlock.query.filter(DateBlock.hotel_id == hotel_id, DateBlock.start_date < end, DateBlock.end_date > start).all()


def is_blocked(hotel_id, start, end):
    as_date = lambda d: d.date() if isinstance(d, datetime) else d  # noqa: E731
    return bool(blocks_between(hotel_id, as_date(start), as_date(end)))


def blocked_nights(hotel_id, start, end):
    nights = set()
    for block in blocks_between(hotel_id, start, end + timedelta(days=1)):
        day = max(block.start_date, start)
        while day < block.end_date and day <= end:
            nights.add(day.isoformat())
            day += timedelta(days=1)
    return nights


def active_bookings(hotel_id, start=None):
    """The site's own bookings that hold dates from ``start`` (today) onwards."""
    start = start or date.today()
    rows = Booking.query.filter(Booking.hotel_id == hotel_id, Booking.status.in_(ACTIVE_STATUSES),
                                Booking.end_date > datetime.combine(start, datetime.min.time())).all()
    return [b for b in rows if b.is_blocking]


# ---- the feed we offer other sites ------------------------------------------
def token_for(hotel):
    if not hotel.calendar_token:
        hotel.calendar_token = new_calendar_token()
        db.session.commit()
    return hotel.calendar_token


def export_ics(hotel, skip_feed_id=None):
    """Busy nights as an iCal file: bookings made here, manual blocks and nights
    imported from other sites — except those from ``skip_feed_id``, so a site
    never gets its own reservations echoed back. No names or prices, only dates."""
    stamp = utcnow().strftime("%Y%m%dT%H%M%SZ")
    day = lambda d: (d.date() if isinstance(d, datetime) else d).strftime("%Y%m%d")  # noqa: E731
    lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Saranda Companion//Availability//EN", "CALSCALE:GREGORIAN"]

    def event(uid, start, end, summary):
        lines.extend(["BEGIN:VEVENT", f"UID:{uid}@saranda-companion", f"DTSTAMP:{stamp}",
                      f"DTSTART;VALUE=DATE:{day(start)}", f"DTEND;VALUE=DATE:{day(end)}", f"SUMMARY:{summary}", "END:VEVENT"])

    for booking in active_bookings(hotel.id):
        event(f"booking-{booking.id}", booking.start_date, booking.end_date, "Reserved")
    today = date.today()
    for block in DateBlock.query.filter(DateBlock.hotel_id == hotel.id, DateBlock.end_date > today).order_by(DateBlock.start_date):
        if skip_feed_id is not None and block.feed_id == skip_feed_id:
            continue
        event(f"block-{block.id}", block.start_date, block.end_date, "Not available")
    lines.append("END:VCALENDAR")
    return "\r\n".join(lines) + "\r\n"


def forget_stay(hotel_id):
    """A stay was removed: drop its feeds and blocks."""
    DateBlock.query.filter_by(hotel_id=hotel_id).delete(synchronize_session=False)
    CalendarFeed.query.filter_by(hotel_id=hotel_id).delete(synchronize_session=False)


def stay_by_token(token):
    if not token or len(token) > 64:
        return None
    return Hotel.query.filter_by(calendar_token=token).first()
