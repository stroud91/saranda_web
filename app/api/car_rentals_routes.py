# app/api/car_rentals_routes.py
from flask import Blueprint, request, jsonify
from app.models import CarRental, db
from app.clerk.clerk_auth import clerk_auth_required

car_rentals_routes = Blueprint("car_rentals", __name__)

@car_rentals_routes.route("/", methods=["GET"])
def get_car_rentals():
    car_rentals = CarRental.query.all()
    return jsonify({"car_rentals": [car_rental.to_dict() for car_rental in car_rentals]}), 200

@car_rentals_routes.route("/<int:id>", methods=["GET"])
def get_car_rental(id):
    car_rental = CarRental.query.get(id)
    if not car_rental:
        return jsonify({"error": "Car rental not found"}), 404
    return jsonify(car_rental.to_dict()), 200

@car_rentals_routes.route("/", methods=["POST"])
@clerk_auth_required
def create_car_rental():
    data = request.get_json()
    required_fields = ["car_model", "car_type", "price_per_day", "rental_company", "location"]
    for field in required_fields:
        if field not in data:
            return jsonify({"error": f"Missing field: {field}"}), 400

    try:
        price = float(data["price_per_day"])
    except ValueError:
        return jsonify({"error": "Invalid price_per_day"}), 400

    new_car_rental = CarRental(
        car_model=data["car_model"],
        car_type=data["car_type"],
        price_per_day=price,
        availability_status=data.get("availability_status", "available"),
        rental_company=data["rental_company"],
        location=data["location"]
    )

    db.session.add(new_car_rental)
    db.session.commit()

    return jsonify(new_car_rental.to_dict()), 201

@car_rentals_routes.route("/<int:id>", methods=["PUT"])
@clerk_auth_required
def update_car_rental(id):
    car_rental = CarRental.query.get(id)
    if not car_rental:
        return jsonify({"error": "Car rental not found"}), 404

    data = request.get_json()

    if "car_model" in data:
        car_rental.car_model = data["car_model"]
    if "car_type" in data:
        car_rental.car_type = data["car_type"]
    if "price_per_day" in data:
        try:
            car_rental.price_per_day = float(data["price_per_day"])
        except ValueError:
            return jsonify({"error": "Invalid price_per_day"}), 400
    if "availability_status" in data:
        car_rental.availability_status = data["availability_status"]
    if "rental_company" in data:
        car_rental.rental_company = data["rental_company"]
    if "location" in data:
        car_rental.location = data["location"]

    db.session.commit()
    return jsonify(car_rental.to_dict()), 200

@car_rentals_routes.route("/<int:id>", methods=["DELETE"])
@clerk_auth_required
def delete_car_rental(id):
    car_rental = CarRental.query.get(id)
    if not car_rental:
        return jsonify({"error": "Car rental not found"}), 404

    db.session.delete(car_rental)
    db.session.commit()

    return jsonify({"message": f"Car rental {id} deleted successfully"}), 200
