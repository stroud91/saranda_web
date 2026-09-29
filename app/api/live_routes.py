from flask import Blueprint, current_app, jsonify

from app.extensions import limiter
from app.services import live, routing
from app.validation import Field, ValidationError, query_args

live_routes = Blueprint("live", __name__)


@live_routes.get("/weather")
@limiter.limit("60 per minute")
def weather():
    """Current weather, sea temperature and 7-day forecast: ?place=sarande"""
    args = query_args({"place": Field("slug", default="sarande")})
    try:
        routing.place(args["place"])
    except routing.UnknownPlace as exc:
        raise ValidationError({"place": str(exc)})
    if not current_app.config.get("LIVE_DATA_ENABLED"):
        typical = live.typical_conditions()
        return jsonify({"place": {"slug": args["place"]}, "live": False, "source": "Typical monthly climate",
                        "current": {"temp": typical["air_high"], "sea_temp": typical["sea"], "label": "Typical for this month",
                                    "icon": "sun", "is_day": True}, "daily": [], "typical": typical})
    return jsonify(live.weather(args["place"]))


@live_routes.get("/fx")
def fx():
    """EUR exchange rates including Albanian lek (ALL)."""
    if not current_app.config.get("LIVE_DATA_ENABLED"):
        return jsonify({"base": "EUR", "rates": {"ALL": live.FALLBACK_EUR_ALL}, "live": False,
                        "source": "Approximate fallback rate"})
    return jsonify(live.fx_rates())
