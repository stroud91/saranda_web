"""Stays (Meg'Rooms apartments): listing, details and availability."""
from datetime import date, datetime, timedelta

from flask import Blueprint, abort, jsonify, request

from app.auth import require_admin
from app.models import Booking, Hotel, db
from app.models.booking import ACTIVE_STATUSES
from app.services import calendars, partners, reviews
from app.validation import Field, json_body, query_args

hotels_routes = Blueprint("hotels", __name__)
NO_REVIEWS = {"average": None, "count": 0}


def _hotel_or_404(hotel_id):
    """A stay guests may see: switched on, approved, and from an approved business (or our own)."""
    hotel = Hotel.query.filter(Hotel.id == hotel_id, partners.public_filter(Hotel)).first()
    if not hotel or hotel.is_active is False:
        abort(404, description="Stay not found")
    return hotel


def blocking_bookings(hotel_id, start, end, lock=False):
    q = Booking.query.filter(
        Booking.hotel_id == hotel_id,
        Booking.status.in_(ACTIVE_STATUSES),
        Booking.start_date < end,
        Booking.end_date > start,
    )
    if lock:
        q = q.with_for_update()
    return [b for b in q.all() if b.is_blocking]


@hotels_routes.get("/")
def list_hotels():
    # The site's own apartments first, then partners', each by price.
    hotels = (Hotel.query.filter(Hotel.is_active.isnot(False), partners.public_filter(Hotel))
              .order_by(Hotel.business_id.isnot(None), Hotel.price_per_night).all())
    rated = reviews.summary([h.id for h in hotels])
    return jsonify([{**h.to_dict(), "reviews": rated.get(h.id, NO_REVIEWS)} for h in hotels])


@hotels_routes.get("/<int:hotel_id>")
def get_hotel(hotel_id):
    hotel = _hotel_or_404(hotel_id)
    return jsonify({**hotel.to_dict(), "reviews": reviews.summary([hotel.id]).get(hotel.id, NO_REVIEWS)})


@hotels_routes.get("/<int:hotel_id>/availability")
def availability(hotel_id):
    """Booked nights between ?from=YYYY-MM-DD&to=YYYY-MM-DD (max 400 days)."""
    _hotel_or_404(hotel_id)
    args = query_args({"from": Field("date"), "to": Field("date")})
    start = args["from"] or date.today()
    end = args["to"] or start + timedelta(days=180)
    end = min(end, start + timedelta(days=400))
    s, e = datetime.combine(start, datetime.min.time()), datetime.combine(end, datetime.min.time())
    nights = set()
    for b in blocking_bookings(hotel_id, s, e):
        d = b.start_date.date()
        while d < b.end_date.date():
            if start <= d <= end:
                nights.add(d.isoformat())
            d += timedelta(days=1)
    nights |= calendars.blocked_nights(hotel_id, start, end)  # blocked by hand or taken on another site
    return jsonify({"hotel_id": hotel_id, "booked_nights": sorted(nights)})


HOTEL_SCHEMA = {
    "hotel_name": Field(required=True, max_len=255),
    "address": Field(required=True, max_len=255),
    "city": Field(required=True, max_len=120),
    "price_per_night": Field("float", required=True, min=1, max=10000),
    "contact_email": Field("email"),
    "apartment_number": Field("int", min=0, max=9999),
    "apartment_name": Field(max_len=255),
    "bedrooms": Field("int", min=0, max=20, default=1),
    "beds": Field("int", min=0, max=40, default=1),
    "bathrooms": Field("float", min=0, max=20, default=1),
    "max_guests": Field("int", min=1, max=40, default=2),
    "tag": Field(max_len=100),
    "description": Field("text", max_len=5000),
    "amenities": Field("list", max_items=60, item=Field(max_len=80)),
    "image_urls": Field("list", max_items=30, item=Field(max_len=500, pattern=r"(https://|/)[^\s\"'<>]+")),
    "min_nights": Field("int", min=1, max=60, default=1),
    "cleaning_fee": Field("float", min=0, max=1000, default=0),
}


@hotels_routes.post("/")
@require_admin
def create_hotel():
    data = json_body(HOTEL_SCHEMA)
    hotel = Hotel(**data, total_rooms=1, available_rooms=1)
    db.session.add(hotel)
    db.session.commit()
    return jsonify(hotel.to_dict()), 201


def _house_hotel_or_404(hotel_id):
    """Admin edits here are for the site's own stays; partners' go through review instead."""
    hotel = db.session.get(Hotel, hotel_id)
    if not hotel or hotel.business_id is not None:
        abort(404, description="Stay not found")
    return hotel


@hotels_routes.put("/<int:hotel_id>")
@require_admin
def update_hotel(hotel_id):
    hotel = _house_hotel_or_404(hotel_id)
    body = request.get_json(silent=True) or {}
    # Partial update: validate only the fields that were sent.
    data = json_body({k: v for k, v in HOTEL_SCHEMA.items() if k in body})
    for k, v in data.items():
        setattr(hotel, k, v)
    db.session.commit()
    return jsonify(hotel.to_dict())


@hotels_routes.delete("/<int:hotel_id>")
@require_admin
def delete_hotel(hotel_id):
    hotel = _house_hotel_or_404(hotel_id)
    hotel.is_active = False  # soft delete keeps booking history intact
    db.session.commit()
    return "", 204
