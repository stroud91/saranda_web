"""Rental cars — public listing, admin management."""
from flask import Blueprint, abort, jsonify, request

from app.auth import require_admin
from app.models import CarRental, db
from app.services import partners
from app.validation import Field, json_body, query_args

car_rentals_routes = Blueprint("car_rentals", __name__)


def _car_or_404(car_id):
    car = db.session.get(CarRental, car_id)
    if not car or car.business_id is not None:  # admin edits are for the site's own rentals
        abort(404, description="Car not found")
    return car


@car_rentals_routes.get("/")
def get_car_rentals():
    """Filter with ?type=SUV"""
    args = query_args({"type": Field(max_len=30)})
    q = CarRental.query.filter(CarRental.availability_status == "available", partners.public_filter(CarRental))
    if args["type"]:
        q = q.filter(CarRental.car_type == args["type"])
    return jsonify([c.to_dict() for c in q.order_by(CarRental.price_per_day).all()])


@car_rentals_routes.get("/<int:car_id>")
def get_car_rental(car_id):
    car = CarRental.query.filter(CarRental.id == car_id, partners.public_filter(CarRental)).first()
    if not car:
        abort(404, description="Car not found")
    return jsonify(car.to_dict())


CAR_SCHEMA = {
    "car_model": Field(required=True, max_len=255),
    "car_type": Field(required=True, max_len=50),
    "price_per_day": Field("float", required=True, min=1, max=5000),
    "rental_company": Field(required=True, max_len=255),
    "location": Field(required=True, max_len=255),
    "availability_status": Field(choices=["available", "unavailable"], default="available"),
    "seats": Field("int", min=1, max=60),
    "transmission": Field(choices=["manual", "automatic"]),
}


@car_rentals_routes.post("/")
@require_admin
def create_car_rental():
    car = CarRental(**json_body(CAR_SCHEMA))
    db.session.add(car)
    db.session.commit()
    return jsonify(car.to_dict()), 201


@car_rentals_routes.put("/<int:car_id>")
@require_admin
def update_car_rental(car_id):
    car = _car_or_404(car_id)
    body = request.get_json(silent=True) or {}
    for k, v in json_body({k: v for k, v in CAR_SCHEMA.items() if k in body}).items():
        setattr(car, k, v)
    db.session.commit()
    return jsonify(car.to_dict())


@car_rentals_routes.delete("/<int:car_id>")
@require_admin
def delete_car_rental(car_id):
    car = _car_or_404(car_id)
    car.availability_status = "unavailable"
    db.session.commit()
    return "", 204
