from flask import Blueprint, request, jsonify
import stripe
import os

stripe.api_key = os.getenv("STRIPE_SECRET_KEY")

payment_routes = Blueprint("payment", __name__)

@payment_routes.route("/create-payment-intent", methods=["POST"])
def create_payment_intent():
    try:
        data = request.get_json()
        amount = data.get("amount")

   
        intent = stripe.PaymentIntent.create(
            amount=int(amount * 100),
            currency="eur",
            payment_method_types=["card"],
        )

        return jsonify({"clientSecret": intent["client_secret"]})
    except Exception as e:
        return jsonify({"error": str(e)}), 400
