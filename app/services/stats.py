"""Visitor statistics that need no cookie banner.

What is counted: how many page views and visitors per day, which pages, where
visitors came from (the other site's name only), their language and whether
they used a phone or a computer. Nothing is stored in the visitor's browser and
no record is kept per person.

To count a visitor once per day, the IP address and browser name are turned
into a code with a key that is different every day. The code is kept until the
next day's clean-up and then deleted, so yesterday's visitors can't be
recognised today and no browsing history can be built.

Not counted: search engines and other robots, the host's own visits, and
anything on the static upload (it has no server to count on).
"""
import hashlib
import hmac
import re
from datetime import date, timedelta
from urllib.parse import urlparse

from flask import current_app
from sqlalchemy.exc import IntegrityError

from app.models import Booking, Hotel, StatCounter, StatVisitor, db
from app.services import seo

LANGS = ("en", "sq", "fr", "it", "de")
BOT = re.compile(r"bot|crawl|spider|slurp|preview|headless|lighthouse|monitor|pingdom|uptime|curl|wget|python-requests|facebookexternalhit|whatsapp|telegram", re.I)
MOBILE = re.compile(r"iphone|android.+mobile|windows phone|ipod", re.I)
TABLET = re.compile(r"ipad|android(?!.*mobile)|tablet", re.I)
# Addresses with someone's private reference in them are counted as one page.
PRIVATE_PAGES = {"booking": "/booking/…", "guide-request": "/guide-request/…", "trip": "/trip/…", "review": "/review/…"}


def enabled():
    return bool(current_app.config.get("STATS_ENABLED", True))


def page_key(path):
    """The address as it is counted, or None if it isn't a page of the site."""
    path = "/" + (path or "").split("?")[0].split("#")[0].strip("/")
    if len(path) > 110:
        return None
    head = path.strip("/").split("/", 1)[0]
    if head in PRIVATE_PAGES and "/" in path.strip("/"):
        return PRIVATE_PAGES[head]
    meta = seo.resolve(path)
    if meta is None:
        return None
    return "/" + meta.path if meta.path else "/"  # old addresses are counted with the page they show


def referrer_key(referrer, own_host):
    """The other site's name ("google.com"), "" for none or for moving around inside this site."""
    try:
        host = (urlparse(referrer or "").hostname or "").lower()
    except ValueError:
        return ""
    host = host[4:] if host.startswith("www.") else host
    own = (own_host or "").lower().split(":")[0]
    own = own[4:] if own.startswith("www.") else own
    if not host or host == own or not re.fullmatch(r"[a-z0-9.-]{3,80}", host) or "." not in host:
        return ""
    return host


def device_key(agent):
    if TABLET.search(agent or ""):
        return "tablet"
    return "phone" if MOBILE.search(agent or "") else "computer"


def visitor_code(ip, agent, day):
    key = hashlib.sha256(f"visitors:{day.isoformat()}:".encode() + current_app.config["SECRET_KEY"].encode()).digest()
    return hmac.new(key, f"{ip}|{agent}".encode("utf-8", "replace"), hashlib.sha256).hexdigest()[:32]


def _add(day, kind, key, n=1):
    key = (key or "")[:120]
    changed = (StatCounter.query.filter_by(day=day, kind=kind, key=key)
               .update({StatCounter.count: StatCounter.count + n}, synchronize_session=False))
    if not changed:
        try:
            with db.session.begin_nested():
                db.session.add(StatCounter(day=day, kind=kind, key=key, count=n))
        except IntegrityError:  # another request created the row in the same instant
            StatCounter.query.filter_by(day=day, kind=kind, key=key).update({StatCounter.count: StatCounter.count + n}, synchronize_session=False)


def record(path, *, referrer="", lang="en", ip="", agent="", own_host="", today=None):
    """Count one page view. Returns True if it was counted."""
    if not enabled() or not agent or BOT.search(agent):
        return False
    page = page_key(path)
    if page is None:
        return False
    day = today or date.today()
    code = visitor_code(ip, agent, day)
    first = False
    try:
        with db.session.begin_nested():
            db.session.add(StatVisitor(day=day, code=code))
        first = True
    except IntegrityError:
        pass  # this browser was already counted today
    _add(day, "views", "")
    _add(day, "page", page)
    if first:  # once per visitor per day: who they are (roughly) and where they came from
        _add(day, "visitors", "")
        _add(day, "entry", page)
        _add(day, "lang", lang if lang in LANGS else "en")
        _add(day, "device", device_key(agent))
        _add(day, "ref", referrer_key(referrer, own_host) or "(direct)")
    db.session.commit()
    return True


def cleanup(today=None):
    """Delete visitor codes from before today, and counters older than STATS_KEEP_DAYS."""
    day = today or date.today()
    gone = StatVisitor.query.filter(StatVisitor.day < day).delete(synchronize_session=False)
    keep = int(current_app.config.get("STATS_KEEP_DAYS", 760))
    gone += StatCounter.query.filter(StatCounter.day < day - timedelta(days=keep)).delete(synchronize_session=False)
    db.session.commit()
    return gone


def _top(start, kind, limit):
    rows = (db.session.query(StatCounter.key, db.func.sum(StatCounter.count)).filter(StatCounter.day >= start, StatCounter.kind == kind)
            .group_by(StatCounter.key).order_by(db.func.sum(StatCounter.count).desc(), StatCounter.key).limit(limit).all())
    return [{"key": key, "count": int(count)} for key, count in rows]


def report(days=30, today=None):
    """What the Host desk shows for the last ``days`` days (today included)."""
    end = today or date.today()
    days = max(1, min(int(days), 366))
    start = end - timedelta(days=days - 1)
    daily = {(day, kind): int(count) for day, kind, count in
             db.session.query(StatCounter.day, StatCounter.kind, StatCounter.count)
             .filter(StatCounter.day >= start, StatCounter.kind.in_(("views", "visitors"))).all()}
    booked = dict(db.session.query(db.func.date(Booking.created_at), db.func.count(Booking.id))
                  .join(Hotel, Booking.hotel_id == Hotel.id).filter(Hotel.business_id.is_(None), Booking.created_at >= start)
                  .group_by(db.func.date(Booking.created_at)).all())
    series = []
    for offset in range(days):
        day = start + timedelta(days=offset)
        series.append({"day": day.isoformat(), "visitors": daily.get((day, "visitors"), 0), "views": daily.get((day, "views"), 0),
                       "bookings": int(booked.get(day.isoformat(), booked.get(day, 0)) or 0)})
    return {
        "days": days, "from": start.isoformat(), "to": end.isoformat(), "series": series,
        "totals": {k: sum(d[k] for d in series) for k in ("visitors", "views", "bookings")},
        "pages": _top(start, "page", 12), "entries": _top(start, "entry", 8), "referrers": _top(start, "ref", 10),
        "languages": _top(start, "lang", 5), "devices": _top(start, "device", 3),
    }
