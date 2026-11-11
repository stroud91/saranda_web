"""Local tour guides: directory, availability and booking requests."""
from datetime import date, timedelta

from flask import Blueprint, abort, jsonify

from app.data import DESTINATION_INDEX, ITINERARY_INDEX
from app.extensions import limiter
from app.models import Guide, GuideBooking, db
from app.models.guide import ACTIVE_REQUEST_STATUSES, DURATIONS
from app.validation import Field, ValidationError, json_body, query_args
from app.services import accounts

guides_routes = Blueprint("guides", __name__)


def _guide_or_404(slug):
    guide = Guide.query.filter_by(slug=slug, is_active=True).first()
    if not guide:
        abort(404, description="Guide not found")
    return guide


@guides_routes.get("/")
def list_guides():
    """Filter with ?language=&specialty=&region=&vehicle=true&group=6"""
    args = query_args({"language": Field(max_len=40), "specialty": Field(max_len=40), "region": Field("slug"),
                       "vehicle": Field("bool"), "group": Field("int", min=1, max=60)})
    out = []
    for g in Guide.query.filter_by(is_active=True).order_by(Guide.is_sample, Guide.id).all():
        if args["language"] and not any(args["language"].lower() == l.lower() for l in g.languages or []):
            continue
        if args["specialty"] and not any(args["specialty"].lower() == s.lower() for s in g.specialties or []):
            continue
        if args["region"] and args["region"] not in (g.regions or []):
            continue
        if args["vehicle"] and not g.has_vehicle:
            continue
        if args["group"] and (g.max_group or 0) < args["group"]:
            continue
        out.append(g.to_dict())
    languages = sorted({l for g in Guide.query.filter_by(is_active=True) for l in (g.languages or [])})
    specialties = sorted({s for g in Guide.query.filter_by(is_active=True) for s in (g.specialties or [])})
    return jsonify({"guides": out, "facets": {"languages": languages, "specialties": specialties}})


@guides_routes.get("/<slug>")
def get_guide(slug):
    guide = _guide_or_404(slug)
    out = guide.to_dict()
    out["signature_stop_details"] = [
        {"slug": s, "name": DESTINATION_INDEX[s]["name"], "category": DESTINATION_INDEX[s]["category"]}
        for s in guide.signature_stops or [] if s in DESTINATION_INDEX
    ]
    return jsonify(out)


def _busy_dates(guide, start, end):
    rows = GuideBooking.query.filter(
        GuideBooking.guide_id == guide.id,
        GuideBooking.status.in_(ACTIVE_REQUEST_STATUSES),
        GuideBooking.tour_date <= end,
        GuideBooking.tour_date >= start - timedelta(days=30),
    ).all()
    busy = set()
    for r in rows:
        for i in range(max(1, r.days or 1)):
            d = r.tour_date + timedelta(days=i)
            if start <= d <= end:
                busy.add(d)
    return busy


@guides_routes.get("/<slug>/availability")
def availability(slug):
    """Dates already requested/booked in a month: ?month=2027-06"""
    guide = _guide_or_404(slug)
    args = query_args({"month": Field(pattern=r"\d{4}-(0[1-9]|1[0-2])", max_len=7)})
    today = date.today()
    first = date.fromisoformat(args["month"] + "-01") if args["month"] else today.replace(day=1)
    last = (first.replace(day=28) + timedelta(days=4)).replace(day=1) - timedelta(days=1)
    busy = _busy_dates(guide, first, last)
    return jsonify({"month": first.strftime("%Y-%m"), "busy": sorted(d.isoformat() for d in busy),
                    "earliest": (today + timedelta(days=1)).isoformat()})


REQUEST_SCHEMA = {
    "tour_date": Field("date", required=True, label="Date"),
    "duration": Field(choices=list(DURATIONS), required=True),
    "days": Field("int", min=1, max=14, default=1),
    "group_size": Field("int", required=True, min=1, max=60, label="Group size"),
    "itinerary_slug": Field("slug"),
    "stops": Field("list", max_items=12, item=Field("slug", required=True)),
    "pickup": Field(max_len=200),
    "language": Field(max_len=40),
    "name": Field(required=True, max_len=120),
    "email": Field("email", required=True, max_len=255),
    "phone": Field("phone", max_len=40),
    "message": Field("text", max_len=2000),
    "website": Field(max_len=200),  # honeypot: humans never fill this
}


@guides_routes.post("/<slug>/requests")
@limiter.limit("8 per hour")
def request_guide(slug):
    """Request a guide. Price is quoted server-side; nothing is charged."""
    guide = _guide_or_404(slug)
    data = json_body(REQUEST_SCHEMA)
    if data["website"]:
        return jsonify({"error": "Request rejected"}), 400
    today = date.today()
    if data["tour_date"] <= today:
        raise ValidationError({"tour_date": "Pick a date from tomorrow onwards"})
    if data["tour_date"] > today + timedelta(days=540):
        raise ValidationError({"tour_date": "Requests open up to 18 months ahead"})
    if data["group_size"] > (guide.max_group or 1):
        raise ValidationError({"group_size": f"{guide.name} guides groups of up to {guide.max_group}"})
    days = data["days"] if data["duration"] == "multi" else 1
    if data["itinerary_slug"] and data["itinerary_slug"] not in ITINERARY_INDEX:
        raise ValidationError({"itinerary_slug": "Unknown itinerary"})
    stops = [s for s in (data["stops"] or []) if s in DESTINATION_INDEX]
    if data["language"] and data["language"] not in (guide.languages or []):
        raise ValidationError({"language": f"{guide.name} doesn't guide in {data['language']}"})

    wanted = {data["tour_date"] + timedelta(days=i) for i in range(days)}
    if wanted & _busy_dates(guide, min(wanted), max(wanted)):
        return jsonify({"error": f"{guide.name} is already booked on one of those dates. Try another day.",
                        "fields": {"tour_date": "Date unavailable"}}), 409

    booking = GuideBooking(
        guide_id=guide.id, tour_date=data["tour_date"], duration=data["duration"], days=days,
        group_size=data["group_size"], itinerary_slug=data["itinerary_slug"], stops=stops,
        pickup=data["pickup"], language=data["language"], name=data["name"], email=data["email"].lower(),
        phone=data["phone"], message=data["message"], quoted_price=guide.quote(data["duration"], days),
        user_id=getattr(accounts.current_user(), "id", None),
    )
    db.session.add(booking)
    db.session.commit()
    return jsonify(booking.to_public_dict()), 201


@guides_routes.get("/requests/<reference>")
def get_request(reference):
    booking = GuideBooking.query.filter_by(reference=reference.upper()[:20]).first()
    if not booking:
        abort(404, description="Request not found")
    return jsonify(booking.to_public_dict())
