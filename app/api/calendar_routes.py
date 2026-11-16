"""A stay's calendar: block dates by hand, connect other booking sites' calendars,
and the link those sites read to learn which nights are taken here.

Who may manage a stay's calendar: the site's host for the site's own stays, and
a partner business for its own. Anyone else gets a plain 404.
"""
from datetime import date, timedelta

from flask import Blueprint, Response, jsonify, request

from app.extensions import limiter
from app.models import Business, CalendarFeed, DateBlock, Hotel, db
from app.services import accounts, calendars
from app.validation import Field, ValidationError, json_body

calendar_routes = Blueprint("calendar", __name__)


def _stay(hotel_id):
    """The stay, if the signed-in account may manage it; otherwise None."""
    user = accounts.current_user()
    hotel = db.session.get(Hotel, hotel_id)
    if not user or not hotel or hotel.review_status == "removed":
        return None
    if hotel.business_id is None:
        return hotel if user.is_admin else None
    business = Business.query.filter_by(owner_id=user.id).first()
    return hotel if business and business.id == hotel.business_id and user.email_verified else None


def _not_found():
    return jsonify({"error": "Not found"}), 404


def _site():
    return accounts.site_url() or request.host_url.rstrip("/")


def _view(hotel):
    token = calendars.token_for(hotel)
    link = f"{_site()}/api/calendar/feed/{token}.ics"
    feeds = CalendarFeed.query.filter_by(hotel_id=hotel.id).order_by(CalendarFeed.id).all()
    blocks = (DateBlock.query.filter(DateBlock.hotel_id == hotel.id, DateBlock.end_date > date.today())
              .order_by(DateBlock.start_date).limit(1000).all())
    bookings = [{"reference": b.reference, "status": b.status, "start_date": b.start_date.date().isoformat(),
                 "end_date": b.end_date.date().isoformat(), "guest": (b.guest_name or "").split(" ")[0]}
                for b in sorted(calendars.active_bookings(hotel.id), key=lambda b: b.start_date)]
    return {
        "stay": {"id": hotel.id, "name": hotel.hotel_name},
        "bookings": bookings,
        "blocks": [b.to_dict() for b in blocks],
        # Each connected site gets its own link, which leaves out that site's own nights.
        "feeds": [{**f.to_dict(), "export_url": f"{link}?skip={f.id}"} for f in feeds],
        "export_url": link,
        "max_feeds": calendars.MAX_FEEDS_PER_STAY,
    }


@calendar_routes.get("/stays/<int:hotel_id>")
@accounts.login_required
def view(hotel_id):
    hotel = _stay(hotel_id)
    if not hotel:
        return _not_found()
    return jsonify(_view(hotel))


@calendar_routes.post("/stays/<int:hotel_id>/blocks")
@accounts.login_required
@limiter.limit("120 per hour")
def add_block(hotel_id):
    """Close some nights by hand. ``end_date`` is the first night that is open again."""
    hotel = _stay(hotel_id)
    if not hotel:
        return _not_found()
    data = json_body({"start_date": Field("date", required=True, label="First night"),
                      "end_date": Field("date", required=True, label="Open again on"),
                      "note": Field(max_len=200)})
    start, end, today = data["start_date"], data["end_date"], date.today()
    if start < today:
        raise ValidationError({"start_date": "Pick a date from today onwards"})
    if end <= start:
        raise ValidationError({"end_date": "Must be after the first night"})
    if (end - start).days > 366 or end > today + timedelta(days=calendars.HORIZON_DAYS):
        raise ValidationError({"end_date": "Block at most a year at a time"})
    clash = [b for b in calendars.active_bookings(hotel.id) if b.start_date.date() < end and b.end_date.date() > start]
    if clash:
        return jsonify({"error": f"There is a booking in those dates ({clash[0].reference}). Cancel it first, or pick other dates.",
                        "fields": {"start_date": "Booked"}}), 409
    db.session.add(DateBlock(hotel_id=hotel.id, start_date=start, end_date=end, note=data["note"]))
    db.session.commit()
    return jsonify(_view(hotel)), 201


@calendar_routes.delete("/stays/<int:hotel_id>/blocks/<int:block_id>")
@accounts.login_required
@limiter.limit("240 per hour")
def remove_block(hotel_id, block_id):
    hotel = _stay(hotel_id)
    block = hotel and DateBlock.query.filter_by(id=block_id, hotel_id=hotel.id, feed_id=None).first()
    if not block:  # imported nights are removed by changing the other site, or disconnecting it
        return _not_found()
    db.session.delete(block)
    db.session.commit()
    return jsonify(_view(hotel))


@calendar_routes.post("/stays/<int:hotel_id>/feeds")
@accounts.login_required
@limiter.limit("30 per hour")
def add_feed(hotel_id):
    """Connect another booking site's calendar (its iCal "export" link)."""
    hotel = _stay(hotel_id)
    if not hotel:
        return _not_found()
    data = json_body({"name": Field(required=True, max_len=60), "url": Field(required=True, max_len=600, label="Calendar link")})
    if not calendars.feed_host_allowed(data["url"]):
        raise ValidationError({"url": "Paste the calendar (iCal) link from Airbnb, Booking.com, Vrbo or Google Calendar. It starts with https://"})
    existing = CalendarFeed.query.filter_by(hotel_id=hotel.id).all()
    if len(existing) >= calendars.MAX_FEEDS_PER_STAY:
        return jsonify({"error": f"A stay can have up to {calendars.MAX_FEEDS_PER_STAY} connected calendars"}), 409
    if any(f.url == data["url"] for f in existing):
        raise ValidationError({"url": "That calendar is already connected"})
    feed = CalendarFeed(hotel_id=hotel.id, name=data["name"], url=data["url"])
    db.session.add(feed)
    db.session.commit()
    calendars.sync_feed(feed)  # try it straight away so a wrong link is noticed now
    return jsonify(_view(hotel)), 201


@calendar_routes.delete("/stays/<int:hotel_id>/feeds/<int:feed_id>")
@accounts.login_required
@limiter.limit("60 per hour")
def remove_feed(hotel_id, feed_id):
    hotel = _stay(hotel_id)
    feed = hotel and CalendarFeed.query.filter_by(id=feed_id, hotel_id=hotel.id).first()
    if not feed:
        return _not_found()
    DateBlock.query.filter_by(feed_id=feed.id).delete(synchronize_session=False)
    db.session.delete(feed)
    db.session.commit()
    return jsonify(_view(hotel))


@calendar_routes.post("/stays/<int:hotel_id>/sync")
@accounts.login_required
@limiter.limit("20 per hour")
def sync_now(hotel_id):
    hotel = _stay(hotel_id)
    if not hotel:
        return _not_found()
    calendars.sync_stay(hotel.id)
    return jsonify(_view(hotel))


@calendar_routes.get("/feed/<token>.ics")
@limiter.limit("120 per hour")
def export(token):
    """What other booking sites fetch: this stay's busy nights. The token in the address is the key."""
    hotel = calendars.stay_by_token(token)
    if not hotel:
        return _not_found()
    skip = request.args.get("skip", "")
    body = calendars.export_ics(hotel, skip_feed_id=int(skip) if skip.isdigit() and len(skip) < 10 else None)
    return Response(body, mimetype="text/calendar", headers={"Cache-Control": "no-store", "X-Robots-Tag": "noindex"})
