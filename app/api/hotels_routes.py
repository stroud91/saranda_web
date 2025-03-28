# app/api/hotels_routes.py
from flask import Blueprint, jsonify, request
from app.models import Hotel, db
from app.clerk.clerk_auth import clerk_auth_required

hotels_routes = Blueprint("hotels", __name__)

@hotels_routes.route("/", methods=["GET"])
def get_hotels():
    hotels = Hotel.query.all()
    return jsonify([hotel.to_dict() for hotel in hotels]), 200

@hotels_routes.route("/<int:id>", methods=["GET"])
def get_hotel(id):
    hotel = Hotel.query.get(id)
    if not hotel:
        return jsonify({"error": "Hotel not found"}), 404
    return jsonify(hotel.to_dict()), 200

@hotels_routes.route("/", methods=["POST"])
@clerk_auth_required
def create_hotel():
    data = request.get_json()
    required_fields = [
        "hotel_name", "address", "price_per_night", "total_rooms", "available_rooms", "city", "contact_email"
    ]
    for field in required_fields:
        if field not in data:
            return jsonify({"error": f"Missing field: {field}"}), 400

    try:
        price = float(data["price_per_night"])
        total_rooms = int(data["total_rooms"])
        available_rooms = int(data["available_rooms"])
    except ValueError:
        return jsonify({"error": "Invalid data type for price or room counts"}), 400

    new_hotel = Hotel(
        hotel_name=data["hotel_name"],
        address=data["address"],
        price_per_night=price,
        total_rooms=total_rooms,
        available_rooms=available_rooms,
        city=data["city"],
        contact_email=data["contact_email"]
    )

    db.session.add(new_hotel)
    db.session.commit()

    return jsonify(new_hotel.to_dict()), 201

@hotels_routes.route("/<int:id>", methods=["PUT"])
@clerk_auth_required
def update_hotel(id):
    hotel = Hotel.query.get(id)
    if not hotel:
        return jsonify({"error": "Hotel not found"}), 404

    data = request.get_json()
    if "hotel_name" in data:
        hotel.hotel_name = data["hotel_name"]
    if "address" in data:
        hotel.address = data["address"]
    if "price_per_night" in data:
        try:
            hotel.price_per_night = float(data["price_per_night"])
        except ValueError:
            return jsonify({"error": "Invalid price_per_night"}), 400
    if "total_rooms" in data:
        try:
            hotel.total_rooms = int(data["total_rooms"])
        except ValueError:
            return jsonify({"error": "Invalid total_rooms"}), 400
    if "available_rooms" in data:
        try:
            hotel.available_rooms = int(data["available_rooms"])
        except ValueError:
            return jsonify({"error": "Invalid available_rooms"}), 400
    if "city" in data:
        hotel.city = data["city"]
    if "contact_email" in data:
        hotel.contact_email = data["contact_email"]

    db.session.commit()
    return jsonify(hotel.to_dict()), 200

@hotels_routes.route("/<int:id>", methods=["DELETE"])
@clerk_auth_required
def delete_hotel(id):
    hotel = Hotel.query.get(id)
    if not hotel:
        return jsonify({"error": "Hotel not found"}), 404

    db.session.delete(hotel)
    db.session.commit()

    return jsonify({"message": f"Hotel {id} deleted successfully"}), 200
