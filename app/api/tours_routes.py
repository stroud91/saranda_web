# app/api/tours_routes.py
from flask import Blueprint, jsonify, request
from app.models import Tour, db
from datetime import datetime
from app.clerk.clerk_auth import clerk_auth_required

tours_routes = Blueprint("tours", __name__)

@tours_routes.route("/", methods=["GET"])
def get_tours():
    tours = Tour.query.all()
    return jsonify([tour.to_dict() for tour in tours]), 200

@tours_routes.route("/<int:id>", methods=["GET"])
def get_tour(id):
    tour = Tour.query.get(id)
    if not tour:
        return jsonify({"error": "Tour not found"}), 404
    return jsonify(tour.to_dict()), 200

@tours_routes.route("/", methods=["POST"])
@clerk_auth_required
def create_tour():
    data = request.get_json()
    required_fields = [
        "tour_name", "description", "price", "start_date", "end_date", "created_by", "location"
    ]
    for field in required_fields:
        if field not in data:
            return jsonify({"error": f"Missing field: {field}"}), 400

    try:
        start_date = datetime.fromisoformat(data["start_date"])
        end_date = datetime.fromisoformat(data["end_date"])
    except Exception:
        return jsonify({"error": "Invalid date format. Use ISO format (YYYY-MM-DDTHH:MM:SS)"}), 400

    try:
        price = float(data["price"])
    except ValueError:
        return jsonify({"error": "Invalid price format"}), 400

    new_tour = Tour(
        tour_name=data["tour_name"],
        description=data["description"],
        price=price,
        start_date=start_date,
        end_date=end_date,
        created_by=data["created_by"],
        location=data["location"],
        is_available=data.get("is_available", True)
    )

    db.session.add(new_tour)
    db.session.commit()
    return jsonify(new_tour.to_dict()), 201

@tours_routes.route("/<int:id>", methods=["PUT"])
@clerk_auth_required
def update_tour(id):
    tour = Tour.query.get(id)
    if not tour:
        return jsonify({"error": "Tour not found"}), 404

    data = request.get_json()
    if "tour_name" in data:
        tour.tour_name = data["tour_name"]
    if "description" in data:
        tour.description = data["description"]
    if "price" in data:
        try:
            tour.price = float(data["price"])
        except ValueError:
            return jsonify({"error": "Invalid price format"}), 400
    if "start_date" in data:
        try:
            tour.start_date = datetime.fromisoformat(data["start_date"])
        except Exception:
            return jsonify({"error": "Invalid start_date format. Use ISO format"}), 400
    if "end_date" in data:
        try:
            tour.end_date = datetime.fromisoformat(data["end_date"])
        except Exception:
            return jsonify({"error": "Invalid end_date format. Use ISO format"}), 400
    if "created_by" in data:
        tour.created_by = data["created_by"]
    if "location" in data:
        tour.location = data["location"]
    if "is_available" in data:
        tour.is_available = data["is_available"]

    db.session.commit()
    return jsonify(tour.to_dict()), 200

@tours_routes.route("/<int:id>", methods=["DELETE"])
@clerk_auth_required
def delete_tour(id):
    tour = Tour.query.get(id)
    if not tour:
        return jsonify({"error": "Tour not found"}), 404

    db.session.delete(tour)
    db.session.commit()
    return jsonify({"message": f"Tour {id} deleted successfully"}), 200
