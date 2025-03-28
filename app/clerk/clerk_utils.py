import os
import jwt
import requests
from flask import current_app

def get_clerk_public_key():
    # You can use the value from your config or the default
    public_key_url = current_app.config.get('CLERK_PUBLIC_KEY_URL', "https://api.clerk.dev/public-key")
    response = requests.get(public_key_url)
    if response.status_code != 200:
        raise Exception("Failed to fetch Clerk public key")
    return response.text

def verify_clerk_token(token):
    public_key = get_clerk_public_key()
    audience = current_app.config.get('CLERK_AUDIENCE')
    issuer = current_app.config.get('CLERK_ISSUER')
    try:
        decoded = jwt.decode(
            token,
            public_key,
            algorithms=["RS256"],
            audience=audience,
            issuer=issuer
        )
        return decoded
    except jwt.ExpiredSignatureError:
        raise Exception("Token expired")
    except jwt.InvalidTokenError as e:
        raise Exception(f"Invalid token: {str(e)}")