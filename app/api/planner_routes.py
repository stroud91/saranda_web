"""Trip planner: day timelines, budgets and saved / shareable trips."""
import json

from flask import Blueprint, Response, abort, jsonify, request

from app.data import DESTINATION_INDEX
from app.extensions import limiter
from app.models import TripPlan, db
from app.services import budget as budget_svc
from app.services import accounts, ics, live, timeline
from app.validation import Field, ValidationError, json_body, validate

planner_routes = Blueprint("planner", __name__)

MAX_TRIP_BYTES = 64 * 1024

DAY_SCHEMA = {
    "title": Field(max_len=80),
    "stops": Field("list", required=True, min=1, max_items=10, item=Field("slug", required=True)),
    "start_time": Field("hhmm", default="08:30"),
    "notes": Field("text", max_len=500),
}


def _clean_days(raw_days, max_days=30):
    if not isinstance(raw_days, list) or not raw_days:
        raise ValidationError({"days": "Add at least one day"})
    if len(raw_days) > max_days:
        raise ValidationError({"days": f"At most {max_days} days"})
    days, errors = [], {}
    for i, raw in enumerate(raw_days):
        try:
            day = validate(DAY_SCHEMA, raw)
        except ValidationError as exc:
            errors[f"days.{i}"] = exc.errors
            continue
        unknown = [s for s in day["stops"] if s not in DESTINATION_INDEX]
        if unknown:
            errors[f"days.{i}"] = {"stops": f"Unknown destination(s): {', '.join(unknown)}"}
            continue
        days.append(day)
    if errors:
        raise ValidationError(errors)
    return days


@planner_routes.post("/timeline")
@limiter.limit("120 per minute")
def build_timeline():
    """Clock-time schedule for one or more days."""
    body = request.get_json(silent=True) or {}
    opts = validate({"pace": Field(choices=list(timeline.PACES), default="balanced"),
                     "start_date": Field("date")}, body)
    days = _clean_days(body.get("days"))
    try:
        result = timeline.build_trip(days, pace=opts["pace"], start_date=opts["start_date"])
    except ValueError as exc:
        raise ValidationError({"days": str(exc)})
    return jsonify(result)


BUDGET_SCHEMA = {
    "travelers": Field("int", required=True, min=1, max=20),
    "days": Field("int", required=True, min=1, max=30),
    "style": Field(choices=["budget", "comfort", "premium"], default="comfort"),
    "month": Field("int", min=1, max=12),
    "car_days": Field("int", min=0, max=30, default=0),
    "boat_days": Field("int", min=0, max=10, default=0),
    "private_boat": Field("bool", default=False),
    "guide_day_rate": Field("float", min=0, max=2000),
    "guide_days": Field("int", min=0, max=30, default=0),
}


@planner_routes.post("/budget")
def estimate_budget():
    """Budget range from the planner's daily budget guide."""
    args = json_body(BUDGET_SCHEMA)
    if args["car_days"] > args["days"]:
        raise ValidationError({"car_days": "Car days can't exceed trip days"})
    return jsonify(budget_svc.estimate(**args, eur_to_all=live.eur_to_all()))


TRIP_SCHEMA = {
    "title": Field(required=True, max_len=120),
    "start_date": Field("date"),
    "travelers": Field("int", min=1, max=20, default=2),
    "style": Field(choices=["budget", "comfort", "premium"], default="comfort"),
    "pace": Field(choices=list(timeline.PACES), default="balanced"),
    "template": Field("slug"),
}


def _trip_payload():
    body = request.get_json(silent=True)
    if body is None:
        raise ValidationError({"_": "Expected a JSON object"})
    if len(json.dumps(body)) > MAX_TRIP_BYTES:
        raise ValidationError({"_": "Trip is too large"})
    meta = validate(TRIP_SCHEMA, body)
    days = _clean_days(body.get("days"))
    checklist = body.get("checklist") or {}
    if not isinstance(checklist, dict) or len(checklist) > 100:
        raise ValidationError({"checklist": "Invalid checklist"})
    checklist = {str(k)[:120]: bool(v) for k, v in checklist.items()}
    data = {**meta, "days": days, "checklist": checklist}
    if data["start_date"]:
        data["start_date"] = data["start_date"].isoformat()
    return meta["title"], data


@planner_routes.post("/trips")
@limiter.limit("20 per hour")
def create_trip():
    """Save a trip. Returns a public share id and a private edit key (shown once)."""
    title, data = _trip_payload()
    plan, key = TripPlan.create(title, data, user_id=getattr(accounts.current_user(), "id", None))
    db.session.add(plan)
    db.session.commit()
    return jsonify({**plan.to_dict(), "edit_key": key}), 201


def _get_plan(share_id):
    if not share_id or len(share_id) > 32:
        abort(404)
    plan = TripPlan.query.filter_by(share_id=share_id).first()
    if not plan:
        abort(404, description="Trip not found")
    return plan


def _may_edit(plan):
    """The secret edit key, or being signed in as the account that saved the trip."""
    if plan.check_key(request.headers.get("X-Edit-Key", "")):
        return True
    user = accounts.current_user()
    return bool(user and plan.user_id and plan.user_id == user.id)


@planner_routes.get("/trips/<share_id>")
def get_trip(share_id):
    return jsonify(_get_plan(share_id).to_dict())


@planner_routes.put("/trips/<share_id>")
@limiter.limit("120 per hour")
def update_trip(share_id):
    plan = _get_plan(share_id)
    if not _may_edit(plan):
        return jsonify({"error": "Edit key required to change this trip"}), 403
    title, data = _trip_payload()
    plan.title, plan.data = title, data
    db.session.commit()
    return jsonify(plan.to_dict())


@planner_routes.delete("/trips/<share_id>")
def delete_trip(share_id):
    plan = _get_plan(share_id)
    if not _may_edit(plan):
        return jsonify({"error": "Edit key required to delete this trip"}), 403
    db.session.delete(plan)
    db.session.commit()
    return "", 204


@planner_routes.get("/trips/<share_id>/calendar.ics")
def trip_calendar(share_id):
    plan = _get_plan(share_id)
    start = ics.parse_start(plan.data.get("start_date"))
    if not start:
        return jsonify({"error": "Set a start date to export a calendar"}), 400
    names = {k: v["name"] for k, v in DESTINATION_INDEX.items()}
    body = ics.trip_calendar(plan.title, start, plan.data.get("days", []), plan.share_id, names)
    return Response(body, mimetype="text/calendar",
                    headers={"Content-Disposition": 'attachment; filename="albania-trip.ics"'})
