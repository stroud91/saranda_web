"""HTTP security layer: headers, CSP, HTTPS, JSON-only writes, request ids."""
import logging
import secrets
from urllib.parse import urlparse

from flask import current_app, g, jsonify, redirect, request

log = logging.getLogger(__name__)

CSP = "; ".join([
    "default-src 'self'",
    "script-src 'self' https://js.stripe.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com data:",
    "img-src 'self' data: blob: https://*.basemaps.cartocdn.com https://tile.openstreetmap.org https://*.tile.openstreetmap.org https://*.stripe.com",
    "media-src 'self' blob:",
    "connect-src 'self' https://api.stripe.com",
    "frame-src https://js.stripe.com https://hooks.stripe.com https://www.youtube-nocookie.com",
    "worker-src 'self'",
    "manifest-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
])

PERMISSIONS = "camera=(), microphone=(), geolocation=(self), payment=(self \"https://js.stripe.com\"), usb=(), interest-cohort=()"

WRITE_METHODS = {"POST", "PUT", "PATCH", "DELETE"}
# Endpoints that legitimately receive non-JSON bodies.
RAW_BODY_PATHS = {"/api/webhooks/stripe"}
# Server-to-server callers: no browser, no cookies, authenticated by signature.
WEBHOOK_PREFIX = "/api/webhooks/"


def _cross_site_write():
    """True when a browser on another site is trying to change something here.

    Guest sessions live in a cookie, so state-changing requests must come from
    our own pages. SameSite=Lax already keeps the cookie off cross-site POSTs;
    this is defence in depth using the headers browsers attach themselves.
    """
    origin = request.headers.get("Origin")
    if origin and origin != "null":
        # Compare hosts, not schemes: behind a TLS-terminating proxy the app may see
        # "http" for a page served over https, and HSTS already rules out downgrade.
        if urlparse(origin).netloc.lower() == request.host.lower():
            return False
        allowed = set(current_app.config.get("CORS_ORIGINS", []))
        allowed.add((current_app.config.get("PUBLIC_BASE_URL") or "").rstrip("/"))
        return origin.rstrip("/") not in allowed
    if origin == "null":
        return True
    return request.headers.get("Sec-Fetch-Site") == "cross-site"


def init_security(app):
    @app.before_request
    def _before():
        g.request_id = request.headers.get("X-Request-ID", "")[:64] or secrets.token_hex(8)
        # Who is signed in is worked out afresh for every request (never carried over).
        g.pop("account_user", None)
        g.pop("account_session", None)
        cfg = current_app.config
        if cfg.get("FORCE_HTTPS") and not request.is_secure and request.headers.get("X-Forwarded-Proto", "http") != "https":
            if request.method in ("GET", "HEAD"):
                return redirect(request.url.replace("http://", "https://", 1), code=301)
            return jsonify({"error": "HTTPS required"}), 400
        if (request.method in WRITE_METHODS and request.path.startswith("/api/")
                and not request.path.startswith(WEBHOOK_PREFIX) and _cross_site_write()):
            return jsonify({"error": "Cross-site request blocked"}), 403
        # JSON-only writes: blocks cross-site HTML form posts (CSRF) outright.
        if (request.method in WRITE_METHODS and request.path.startswith("/api/")
                and request.path not in RAW_BODY_PATHS and request.content_length):
            if not request.is_json:
                return jsonify({"error": "Content-Type must be application/json"}), 415

    @app.after_request
    def _after(resp):
        h = resp.headers
        h.setdefault("X-Content-Type-Options", "nosniff")
        h.setdefault("X-Frame-Options", "DENY")
        h.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
        h.setdefault("Permissions-Policy", PERMISSIONS)
        h.setdefault("Cross-Origin-Opener-Policy", "same-origin")
        h.setdefault("Cross-Origin-Resource-Policy", "same-site")
        csp = CSP + ("; upgrade-insecure-requests" if current_app.config.get("FORCE_HTTPS") else "")
        h.setdefault("Content-Security-Policy", csp)
        h["X-Request-ID"] = getattr(g, "request_id", "")
        if current_app.config.get("FORCE_HTTPS"):
            h.setdefault("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload")
        if request.path.startswith("/api/"):
            h.setdefault("Cache-Control", "no-store")
            if "Set-Cookie" in h or request.cookies:
                h.add("Vary", "Cookie")
        h.pop("Server", None)
        return resp
