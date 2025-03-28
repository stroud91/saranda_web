# app/api/auth_routes.py
from flask import Blueprint, jsonify, request
from app.clerk.clerk_auth import clerk_auth_required

auth_routes = Blueprint('auth', __name__)

@auth_routes.route('/authenticate')
@clerk_auth_required
def authenticate():
    """
    Returns the decoded Clerk token (user info) if the request is authorized.
    """
    # The decoded Clerk info is attached to request.clerk_user
    return jsonify(request.clerk_user), 200

# Optionally, you can remove traditional login/logout if you rely on Clerk.
