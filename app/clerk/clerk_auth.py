from functools import wraps
from flask import request, jsonify
from .clerk_utils import verify_clerk_token 

def clerk_auth_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        auth_header = request.headers.get("Authorization", None)
        if not auth_header:
            return jsonify({"error": "Missing Authorization header"}), 401

        parts = auth_header.split()
        if parts[0].lower() != "bearer" or len(parts) != 2:
            return jsonify({"error": "Invalid Authorization header format"}), 401

        token = parts[1]
        try:
            decoded_token = verify_clerk_token(token)
        except Exception as e:
            return jsonify({"error": str(e)}), 401

        
        request.clerk_user = decoded_token
        return f(*args, **kwargs)
    return decorated_function
