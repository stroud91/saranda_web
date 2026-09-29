"""Destinations, itineraries, route connections and practical essentials."""
from flask import Blueprint, abort, current_app, jsonify, request

from app.data import CATEGORIES, REGIONS
from app.extensions import limiter
from app.services import knowledge, links, live, routing
from app.validation import Field, ValidationError, query_args

knowledge_routes = Blueprint("knowledge", __name__)

SLUG = Field("slug", required=True, max_len=80)


def _dest_or_404(slug):
    try:
        return routing.place(slug)
    except routing.UnknownPlace:
        abort(404, description="Destination not found")


@knowledge_routes.get("/destinations")
def list_destinations():
    """All destinations; filter with ?category=&region=&q="""
    args = query_args({"q": Field(max_len=80), "category": Field(choices=list(CATEGORIES)),
                       "region": Field(choices=list(REGIONS))})
    items = knowledge.search_destinations(args["q"], args["category"], args["region"], limit=100)
    return jsonify({"destinations": items, "regions": REGIONS, "categories": CATEGORIES})


@knowledge_routes.get("/destinations/<slug>")
def get_destination(slug):
    _dest_or_404(slug)
    return jsonify(knowledge.destination_detail(slug))


@knowledge_routes.get("/destinations/<slug>/links")
def destination_links(slug):
    """Pre-filled searches on Booking.com, Airbnb, Google, GetYourGuide, Viator…"""
    _dest_or_404(slug)
    args = query_args({"checkin": Field("date"), "checkout": Field("date"), "adults": Field("int", min=1, max=16, default=2)})
    return jsonify(links.all_links(slug, checkin=args["checkin"] and args["checkin"].isoformat(),
                                   checkout=args["checkout"] and args["checkout"].isoformat(), adults=args["adults"]))


@knowledge_routes.get("/destinations/<slug>/place")
@limiter.limit("60 per minute")
def destination_place(slug):
    """Google rating and opening status (when GOOGLE_MAPS_API_KEY is set)."""
    _dest_or_404(slug)
    if not current_app.config.get("LIVE_DATA_ENABLED"):
        return jsonify({"configured": False})
    return jsonify(live.google_place(slug))


@knowledge_routes.get("/itineraries")
def list_itineraries():
    return jsonify({"itineraries": knowledge.list_itineraries()})


@knowledge_routes.get("/itineraries/<slug>")
def get_itinerary(slug):
    it = knowledge.itinerary_detail(slug)
    if not it:
        abort(404, description="Itinerary not found")
    return jsonify(it)


@knowledge_routes.get("/essentials")
def get_essentials():
    """Everything from the planner's practical chapters."""
    return jsonify(knowledge.all_essentials())


@knowledge_routes.get("/routes/graph")
def route_graph():
    return jsonify(routing.graph_payload())


def _modes(raw):
    if not raw:
        return routing.ALL_MODES
    modes = frozenset(m for m in raw.split(",") if m in routing.ALL_MODES)
    if not modes:
        raise ValidationError({"modes": "modes must include drive, ferry or boat"})
    return modes


@knowledge_routes.get("/routes/connect")
def connect():
    """Fastest connection between two places: ?from=&to=&via=a,b&modes=drive,ferry"""
    args = query_args({"from": Field("slug", required=True), "to": Field("slug", required=True),
                       "via": Field(max_len=400), "modes": Field(max_len=40)})
    via = [v for v in (args["via"] or "").split(",") if v][:8]
    stops = [args["from"], *via, args["to"]]
    try:
        result = routing.route_through(stops, _modes(args["modes"]))
    except routing.UnknownPlace as exc:
        raise ValidationError({"from": str(exc)})
    result["directions_url"] = routing.google_directions_url(result["hops"])
    return jsonify(result)


@knowledge_routes.get("/routes/geometry")
@limiter.limit("30 per minute")
def geometry():
    """Road polyline through ?stops=a,b,c (OSRM when enabled, else straight)."""
    raw = request.args.get("stops", "")
    stops = [s for s in raw.split(",") if s][:12]
    if len(stops) < 2:
        raise ValidationError({"stops": "Provide at least two stops"})
    try:
        for s in stops:
            routing.place(s)
    except routing.UnknownPlace as exc:
        raise ValidationError({"stops": str(exc)})
    if not current_app.config.get("LIVE_DATA_ENABLED"):
        return jsonify({"coords": [[routing.place(s)["lat"], routing.place(s)["lng"]] for s in stops],
                        "source": "straight", "live": False})
    return jsonify(live.road_geometry(stops))
