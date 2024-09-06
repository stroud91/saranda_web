import requests
from flask import Blueprint, jsonify, request

auth_routes = Blueprint('auth', __name__)

CLERK_API_KEY = "YOUR_CLERK_API_KEY"

@auth_routes.route('/clerk-auth', methods=['POST'])
def clerk_auth():
    # Get the token from the frontend request
    token = request.headers.get('Authorization').split(" ")[1]

    # Verify the token by calling Clerk's API
    headers = {
        'Authorization': f'Bearer {CLERK_API_KEY}'
    }

    response = requests.get(f'https://api.clerk.dev/v1/tokens/{token}', headers=headers)

    if response.status_code != 200:
        return {'errors': ['Invalid Token']}, 401

    # Retrieve user data from Clerk's response
    user_data = response.json()

    user_id = user_data.get('user_id')

    if not user_id:
        return {'errors': ['User not found']}, 404

    # At this point, you would check if the user exists in your database or create a new user.
    # For example:
    # user = User.query.filter_by(clerk_id=user_id).first()

    # If user doesn't exist, create a new user
    # if not user:
    #     user = User(username=user_data['username'], email=user_data['email'], clerk_id=user_id)
    #     db.session.add(user)
    #     db.session.commit()

    return jsonify({"user_id": user_id, "username": user_data['username']})

