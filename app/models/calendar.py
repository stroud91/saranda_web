"""Availability beyond the site's own bookings: dates a host blocks by hand,
and dates imported from other booking sites' calendar feeds (Airbnb,
Booking.com…), so the same night is never sold twice."""
import secrets

from .db import add_prefix_for_prod, db, table_args, utcnow


class CalendarFeed(db.Model):
    """An external iCal feed for one stay. Its events are copied into DateBlock rows."""

    __tablename__ = "calendar_feeds"
    __table_args__ = table_args()

    id = db.Column(db.Integer, primary_key=True)
    hotel_id = db.Column(db.Integer, db.ForeignKey(add_prefix_for_prod("hotels.id")), nullable=False, index=True)
    name = db.Column(db.String(60), nullable=False)
    url = db.Column(db.String(600), nullable=False)
    last_synced_at = db.Column(db.DateTime, nullable=True)  # last attempt
    last_ok_at = db.Column(db.DateTime, nullable=True)      # last attempt that worked
    last_error = db.Column(db.String(200), nullable=True)
    events = db.Column(db.Integer, default=0)
    created_at = db.Column(db.DateTime, default=utcnow)

    def to_dict(self):
        iso = lambda d: d.isoformat() + "Z" if d else None  # noqa: E731
        return {"id": self.id, "name": self.name, "url": self.url, "events": self.events or 0,
                "last_synced_at": iso(self.last_synced_at), "last_ok_at": iso(self.last_ok_at),
                "last_error": self.last_error}


class DateBlock(db.Model):
    """Nights a stay can't be booked. ``end_date`` is the first free day (like a check-out)."""

    __tablename__ = "date_blocks"
    __table_args__ = table_args()

    id = db.Column(db.Integer, primary_key=True)
    hotel_id = db.Column(db.Integer, db.ForeignKey(add_prefix_for_prod("hotels.id")), nullable=False, index=True)
    # Null for a block made by hand; otherwise the feed it was imported from.
    feed_id = db.Column(db.Integer, db.ForeignKey(add_prefix_for_prod("calendar_feeds.id")), nullable=True, index=True)
    start_date = db.Column(db.Date, nullable=False)
    end_date = db.Column(db.Date, nullable=False)
    note = db.Column(db.String(200), nullable=True)
    created_at = db.Column(db.DateTime, default=utcnow)

    def to_dict(self):
        return {"id": self.id, "start_date": self.start_date.isoformat(), "end_date": self.end_date.isoformat(),
                "note": self.note, "feed_id": self.feed_id, "manual": self.feed_id is None}


def new_calendar_token():
    """Secret part of a stay's export link. Whoever has it can see which nights are taken (nothing else)."""
    return secrets.token_urlsafe(24)
