"""Experiences (tours) — public listing, admin management."""
from datetime import datetime

from flask import Blueprint, abort, jsonify, request

from app.auth import require_admin
from app.models import Tour, db
from app.services import partners
from app.validation import Field, json_body

tours_routes = Blueprint("tours", __name__)


def _tour_or_404(tour_id):
    tour = db.session.get(Tour, tour_id)
    if not tour or tour.business_id is not None:  # admin edits are for the site's own experiences
        abort(404, description="Experience not found")
    return tour


@tours_routes.get("/")
def get_tours():
    tours = Tour.query.filter(Tour.is_available.isnot(False), partners.public_filter(Tour)).order_by(Tour.price).all()
    return jsonify([t.to_dict() for t in tours])


@tours_routes.get("/<int:tour_id>")
def get_tour(tour_id):
    tour = Tour.query.filter(Tour.id == tour_id, partners.public_filter(Tour)).first()
    if not tour:
        abort(404, description="Experience not found")
    return jsonify(tour.to_dict())


TOUR_SCHEMA = {
    "tour_name": Field(required=True, max_len=255),
    "description": Field("text", required=True, max_len=5000),
    "price": Field("float", required=True, min=0, max=100000),
    "location": Field(required=True, max_len=255),
    "category": Field(max_len=40),
    "duration_hours": Field("float", min=0.5, max=240),
    "destination_slug": Field("slug"),
    "guide_id": Field("int", min=1),
    "is_available": Field("bool", default=True),
}


@tours_routes.post("/")
@require_admin
def create_tour():
    data = json_body(TOUR_SCHEMA)
    now = datetime.utcnow().replace(minute=0, second=0, microsecond=0)
    tour = Tour(**data, start_date=now, end_date=now)
    db.session.add(tour)
    db.session.commit()
    return jsonify(tour.to_dict()), 201


@tours_routes.put("/<int:tour_id>")
@require_admin
def update_tour(tour_id):
    tour = _tour_or_404(tour_id)
    body = request.get_json(silent=True) or {}
    for k, v in json_body({k: v for k, v in TOUR_SCHEMA.items() if k in body}).items():
        setattr(tour, k, v)
    db.session.commit()
    return jsonify(tour.to_dict())


@tours_routes.delete("/<int:tour_id>")
@require_admin
def delete_tour(tour_id):
    tour = _tour_or_404(tour_id)
    tour.is_available = False
    db.session.commit()
    return "", 204
