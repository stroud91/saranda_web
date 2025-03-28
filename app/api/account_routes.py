# app/api/account_routes.py
from flask import Blueprint, jsonify, request
from app.models import User, db
from app.clerk.clerk_auth import clerk_auth_required

account_routes = Blueprint('account', __name__)

@account_routes.route('/me', methods=['GET'])
@clerk_auth_required
def get_account():
    # Access Clerk data from request.clerk_user
    clerk_user = request.clerk_user
    # For example, using the Clerk email to find a local user record:
    email = clerk_user.get('email')
    user = User.query.filter_by(email=email).first()
    if not user:
        return jsonify({"error": "Local user record not found"}), 404
    return jsonify(user.to_dict())

@account_routes.route('/me', methods=['PUT'])
@clerk_auth_required
def update_account():
    data = request.get_json()
    clerk_user = request.clerk_user
    email = clerk_user.get('email')
    user = User.query.filter_by(email=email).first()
    if not user:
        return jsonify({"error": "Local user record not found"}), 404

    if 'username' in data:
        user.username = data['username']
    if 'email' in data:
        user.email = data['email']
    if 'profile_picture' in data:
        user.profile_picture = data['profile_picture']
    if 'bio' in data:
        user.bio = data['bio']

    db.session.commit()
    return jsonify(user.to_dict())
