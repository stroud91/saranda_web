from flask import Blueprint, jsonify, request
from flask_login import current_user, login_required
from app.models import User, db

account_routes = Blueprint('account', __name__)

@account_routes.route('/me', methods=['GET'])
@login_required
def get_account():
    """
    Fetch current user account details
    """
    return current_user.to_dict()

@account_routes.route('/me', methods=['PUT'])
@login_required
def update_account():
    """
    Update the user's account details
    """
    data = request.json
    user = User.query.get(current_user.id)

    if 'username' in data:
        user.username = data['username']
    if 'email' in data:
        user.email = data['email']
    if 'profile_picture' in data:
        user.profile_picture = data['profile_picture']
    if 'bio' in data:
        user.bio = data['bio']

    db.session.commit()
    return user.to_dict()
