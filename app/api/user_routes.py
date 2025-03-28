# app/api/user_routes.py
from flask import Blueprint, jsonify, request
from app.models import User
from app.clerk.clerk_auth import clerk_auth_required

user_routes = Blueprint('users', __name__)

@user_routes.route('/')
@clerk_auth_required
def users():
    users = User.query.all()
    return jsonify({'users': [user.to_dict() for user in users]})

@user_routes.route('/<int:id>')
@clerk_auth_required
def user(id):
    user = User.query.get(id)
    if not user:
        return jsonify({"error": "User not found"}), 404
    return jsonify(user.to_dict())
