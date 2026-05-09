from flask import Blueprint, jsonify, request
from app.models import Booking, Hotel, Tour, CarRental, db
from datetime import datetime
import stripe
import os

stripe.api_key = os.getenv("STRIPE_SECRET_KEY")

bookings_routes = Blueprint("bookings", __name__)


@bookings_routes.route("/", methods=["POST"])
def create_booking():
    data = request.get_json()

    required = ['start_date', 'end_date', 'guest_name', 'guest_email', 'amount_cents']
    for field in required:
        if not data.get(field):
            return jsonify({'error': f'Missing required field: {field}'}), 400

    try:
        start = datetime.fromisoformat(data['start_date'])
        end = datetime.fromisoformat(data['end_date'])
    except (ValueError, TypeError):
        return jsonify({'error': 'Invalid date format. Use ISO 8601 (YYYY-MM-DD)'}), 400

    if end <= start:
        return jsonify({'error': 'Check-out must be after check-in'}), 400

    amount_cents = int(data['amount_cents'])
    if amount_cents < 100:
        return jsonify({'error': 'Amount must be at least €1.00'}), 400

    # Create Stripe PaymentIntent
    try:
        intent = stripe.PaymentIntent.create(
            amount=amount_cents,
            currency='eur',
            payment_method_types=['card'],
            metadata={
                'guest_email': data['guest_email'],
                'guest_name': data['guest_name'],
            }
        )
    except stripe.error.StripeError as e:
        return jsonify({'error': str(e.user_message)}), 400

    nights = (end - start).days or 1
    total_cost = amount_cents / 100

    booking = Booking(
        user_id=None,
        hotel_id=data.get('hotel_id'),
        tour_id=data.get('tour_id'),
        car_id=data.get('car_id'),
        start_date=start,
        end_date=end,
        total_cost=total_cost,
        guest_name=data['guest_name'],
        guest_email=data['guest_email'],
        guest_phone=data.get('guest_phone', ''),
        guest_count=data.get('guest_count', 1),
        notes=data.get('notes', ''),
        stripe_payment_intent_id=intent['id'],
        status='pending',
    )
    db.session.add(booking)
    db.session.commit()

    return jsonify({
        'booking': booking.to_dict(),
        'clientSecret': intent['client_secret'],
    }), 201


@bookings_routes.route("/<int:id>", methods=["GET"])
def get_booking(id):
    booking = Booking.query.get(id)
    if not booking:
        return jsonify({'error': 'Booking not found'}), 404

    result = booking.to_dict()

    if booking.hotel_id and booking.hotel:
        result['hotel_name'] = booking.hotel.hotel_name
        result['hotel_address'] = booking.hotel.address

    return jsonify(result), 200


@bookings_routes.route("/<int:id>/confirm", methods=["PATCH"])
def confirm_booking(id):
    booking = Booking.query.get(id)
    if not booking:
        return jsonify({'error': 'Booking not found'}), 404

    booking.status = 'confirmed'
    db.session.commit()
    return jsonify(booking.to_dict()), 200
