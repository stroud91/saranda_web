"""Admin authentication via Clerk session tokens (RS256 JWTs).

Travellers never need an account: bookings and trips use unguessable
references instead. Only the operator's admin endpoints require a token.

- Keys come from Clerk's JWKS endpoint and are cached by PyJWKClient.
- ``iss`` must match CLERK_ISSUER; ``azp`` must be an authorized party when
  CLERK_AUTHORIZED_PARTIES is configured; ``exp``/``nbf`` are enforced.
- Admins are allow-listed by Clerk user id (or email / role claim).
"""
from functools import lru_cache, wraps

import jwt
from flask import current_app, g, jsonify, request


class AuthError(Exception):
    def __init__(self, message, status=401):
        super().__init__(message)
        self.status = status


@lru_cache(maxsize=4)
def _jwks_client(url):
    return jwt.PyJWKClient(url, cache_keys=True, lifespan=3600, timeout=5)


def verify_token(token):
    cfg = current_app.config
    issuer = cfg.get("CLERK_ISSUER")
    if not issuer:
        raise AuthError("Admin authentication is not configured", 503)
    jwks_url = cfg.get("CLERK_JWKS_URL") or issuer.rstrip("/") + "/.well-known/jwks.json"
    try:
        signing_key = _jwks_client(jwks_url).get_signing_key_from_jwt(token)
        claims = jwt.decode(
            token,
            signing_key.key,
            algorithms=["RS256"],
            issuer=issuer,
            options={"require": ["exp", "iat", "sub", "iss"]},
            leeway=10,
        )
    except jwt.ExpiredSignatureError:
        raise AuthError("Session expired")
    except (jwt.InvalidTokenError, jwt.PyJWKClientError):
        raise AuthError("Invalid session token")
    parties = cfg.get("CLERK_AUTHORIZED_PARTIES")
    if parties and claims.get("azp") not in parties:
        raise AuthError("Token was not issued for this site")
    return claims


def is_admin(claims):
    cfg = current_app.config
    if claims.get("sub") in cfg.get("ADMIN_USER_IDS", []):
        return True
    email = (claims.get("email") or "").lower()
    if email and email in cfg.get("ADMIN_EMAILS", []):
        return True
    meta = claims.get("metadata") or claims.get("public_metadata") or {}
    return claims.get("role") == "admin" or (isinstance(meta, dict) and meta.get("role") == "admin")


def _bearer():
    header = request.headers.get("Authorization", "")
    scheme, _, token = header.partition(" ")
    if scheme.lower() != "bearer" or not token or len(token) > 4096:
        raise AuthError("Missing bearer token")
    return token.strip()


def require_admin(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        try:
            claims = verify_token(_bearer())
        except AuthError as exc:
            return jsonify({"error": str(exc)}), exc.status
        if not is_admin(claims):
            return jsonify({"error": "Admin access required"}), 403
        g.claims = claims
        return fn(*args, **kwargs)
    return wrapper
