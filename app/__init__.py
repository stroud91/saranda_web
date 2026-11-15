"""Saranda Companion — Flask API + SPA host.

``create_app`` builds a configured app. ``flask`` CLI commands find it via
``FLASK_APP=app``; production servers use ``wsgi:app``.
"""
import logging
import os

from flask import Flask, jsonify, request, send_from_directory
from werkzeug.exceptions import HTTPException
from werkzeug.middleware.proxy_fix import ProxyFix

from .config import Config
from .extensions import cors, db, limiter, migrate
from .security import init_security
from .validation import ValidationError

STATIC_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "travago-tour-app", "build"))


def _register_blueprints(app):
    from .api.account_routes import account_routes
    from .api.admin_listing_routes import admin_listing_routes
    from .api.admin_routes import admin_routes
    from .api.auth_routes import auth_routes
    from .api.bookings_routes import bookings_routes
    from .api.business_routes import business_routes
    from .api.calendar_routes import calendar_routes
    from .api.car_rentals_routes import car_rentals_routes
    from .api.concierge_routes import concierge_routes
    from .api.contact_routes import contact_routes
    from .api.guides_routes import guides_routes
    from .api.hotels_routes import hotels_routes
    from .api.knowledge_routes import knowledge_routes
    from .api.live_routes import live_routes
    from .api.meta_routes import meta_routes
    from .api.partner_routes import partner_routes
    from .api.planner_routes import planner_routes
    from .api.tours_routes import tours_routes
    from .api.review_routes import review_routes
    from .api.upload_routes import upload_routes
    from .api.webhooks import webhook_routes

    for bp, prefix in [
        (meta_routes, "/api/meta"),
        (knowledge_routes, "/api"),
        (live_routes, "/api/live"),
        (planner_routes, "/api/planner"),
        (guides_routes, "/api/guides"),
        (hotels_routes, "/api/hotels"),
        (bookings_routes, "/api/bookings"),
        (tours_routes, "/api/tours"),
        (car_rentals_routes, "/api/car_rentals"),
        (concierge_routes, "/api/concierge"),
        (contact_routes, "/api/contact"),
        (admin_routes, "/api/admin"),
        (auth_routes, "/api/auth"),
        (account_routes, "/api/account"),
        (partner_routes, "/api/partner"),
        (business_routes, "/api/businesses"),
        (calendar_routes, "/api/calendar"),
        (upload_routes, "/api/uploads"),
        (review_routes, "/api/reviews"),
        (admin_listing_routes, "/api/admin/listings"),
        (webhook_routes, "/api/webhooks"),
    ]:
        app.register_blueprint(bp, url_prefix=prefix)
    # Trips live under /api/trips for nicer share URLs.
    app.add_url_rule("/api/trips", view_func=app.view_functions["planner.create_trip"], methods=["POST"])
    app.add_url_rule("/api/trips/<share_id>", view_func=app.view_functions["planner.get_trip"], methods=["GET"])
    app.add_url_rule("/api/trips/<share_id>", endpoint="trip_update",
                     view_func=app.view_functions["planner.update_trip"], methods=["PUT"])
    app.add_url_rule("/api/trips/<share_id>", endpoint="trip_delete",
                     view_func=app.view_functions["planner.delete_trip"], methods=["DELETE"])
    app.add_url_rule("/api/trips/<share_id>/calendar.ics",
                     view_func=app.view_functions["planner.trip_calendar"], methods=["GET"])


def _register_errors(app):
    @app.errorhandler(ValidationError)
    def _validation(exc):
        errors = exc.errors
        first = next(iter(errors.values())) if errors else "Invalid request"
        while isinstance(first, dict):
            first = next(iter(first.values()), "Invalid request")
        return jsonify({"error": first, "fields": errors}), 400

    @app.errorhandler(HTTPException)
    def _http(exc):
        if request.path.startswith("/api/"):
            messages = {404: "Not found", 405: "Method not allowed", 413: "Request too large",
                        429: "Too many requests — please slow down", 415: "Unsupported media type"}
            desc = exc.description if exc.code == 404 and exc.description and "requested URL" not in exc.description else None
            return jsonify({"error": desc or messages.get(exc.code, exc.name)}), exc.code
        if exc.code == 404:
            return _page(request.path.strip("/"))
        return exc

    @app.errorhandler(Exception)
    def _unhandled(exc):
        logging.getLogger(__name__).exception("unhandled error")
        db.session.rollback()
        return jsonify({"error": "Something went wrong on our side. Please try again."}), 500


def _page(path):
    """The app's page for an address, with that address's own title, description and
    preview tags (see services/seo.py). Addresses that lead nowhere answer 404."""
    from .services import seo

    index = os.path.join(STATIC_DIR, "index.html")
    if not os.path.exists(index):
        return jsonify({"error": "Frontend not built. Run `npm run build` in travago-tour-app."}), 404
    if seo.is_asset(path):  # a script or image that isn't there must not come back as a web page
        return jsonify({"error": "Not found"}), 404
    lang = request.args.get("lang", "en")
    lang = lang if lang in seo.LANGS else "en"
    meta = seo.resolve(path, lang)
    html = seo.render(seo.shell(index), meta or seo.NOT_FOUND, seo.base_url(request), lang)
    resp = app_response(html, 200 if meta else 404)
    resp.headers["Cache-Control"] = "no-cache"
    return resp


def app_response(html, status):
    from flask import Response

    return Response(html, status=status, mimetype="text/html")


def create_app(config_object=Config):
    app = Flask(__name__, static_folder=None)
    app.config.from_object(config_object)

    if app.config.get("IS_PRODUCTION") and not app.config.get("SECRET_KEY"):
        raise RuntimeError("SECRET_KEY must be set in production")
    if not app.config.get("SECRET_KEY"):
        app.config["SECRET_KEY"] = os.urandom(32).hex()

    hops = app.config.get("TRUSTED_PROXY_HOPS", 1)
    if hops:
        # X-Forwarded-Host is deliberately not trusted (host-header poisoning).
        app.wsgi_app = ProxyFix(app.wsgi_app, x_for=hops, x_proto=hops)

    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")

    db.init_app(app)
    migrate.init_app(app, db, directory=os.path.join(os.path.dirname(__file__), "..", "migrations"))
    cors.init_app(app, resources={r"/api/*": {"origins": app.config["CORS_ORIGINS"]}},
                  supports_credentials=False, allow_headers=["Content-Type", "Authorization", "X-Edit-Key"],
                  expose_headers=["X-Request-ID", "Retry-After"], max_age=600)
    app.config.setdefault("RATELIMIT_KEY_PREFIX", "sc")
    limiter.init_app(app)

    from .services import upstream
    if app.config.get("OSRM_URL"):
        from urllib.parse import urlparse
        upstream.allow_host(urlparse(app.config["OSRM_URL"]).hostname)

    init_security(app)
    _register_blueprints(app)
    _register_errors(app)

    from .seeds import seed_commands
    app.cli.add_command(seed_commands)
    from .cli import calendar_commands, user_commands
    app.cli.add_command(user_commands)
    app.cli.add_command(calendar_commands)

    @app.get("/api/docs")
    def api_docs():
        """All API routes and their docstrings."""
        methods = {"GET", "POST", "PUT", "PATCH", "DELETE"}
        return jsonify({
            rule.rule: [sorted(m for m in rule.methods if m in methods),
                        (app.view_functions[rule.endpoint].__doc__ or "").strip()]
            for rule in app.url_map.iter_rules() if rule.rule.startswith("/api/")
        })

    if app.config.get("IS_PRODUCTION"):
        # Keep the route map out of production (less reconnaissance surface).
        app.view_functions["api_docs"] = lambda: (jsonify({"error": "Not found"}), 404)

    @app.get("/media/u/<name>")
    @limiter.exempt
    def uploaded_photo(name):
        """A photo uploaded for a listing. Names are random and fixed in shape, the folder
        holds nothing else, and the type is always image/jpeg whatever the file contains."""
        from .services import uploads

        path = uploads.path_for(name)
        if not path or not os.path.isfile(path):
            return jsonify({"error": "Not found"}), 404
        resp = send_from_directory(os.path.dirname(path), os.path.basename(path), mimetype="image/jpeg", max_age=31536000)
        resp.headers["Cache-Control"] = "public, max-age=31536000, immutable"
        resp.headers["Content-Disposition"] = "inline"
        return resp

    # The site's own pages, scripts, images and videos are not rate-limited: one
    # visit loads 30+ files, so counting them would block guests who click through
    # a few pages. Every /api endpoint keeps its limits.
    @app.get("/", defaults={"path": ""})
    @app.get("/<path:path>")
    @limiter.exempt
    def spa(path):
        if path.startswith(("api/", "media/u/")):  # neither is ever a page
            return jsonify({"error": "Not found"}), 404
        full = os.path.join(STATIC_DIR, path)
        if path and os.path.isfile(full) and os.path.commonpath([STATIC_DIR, os.path.abspath(full)]) == STATIC_DIR:
            resp = send_from_directory(STATIC_DIR, path)
            if path.startswith("assets/"):
                resp.headers["Cache-Control"] = "public, max-age=31536000, immutable"
            return resp
        return _page(path)

    @app.get("/sitemap.xml")
    @limiter.exempt
    def sitemap():
        from flask import Response

        from .services import seo

        base = seo.base_url(request)
        if not base:
            return jsonify({"error": "Not found"}), 404
        return Response(seo.sitemap(base), mimetype="application/xml", headers={"Cache-Control": "public, max-age=3600"})

    @app.get("/robots.txt")
    @limiter.exempt
    def robots():
        from flask import Response

        from .services import seo

        return Response(seo.robots(seo.base_url(request)), mimetype="text/plain", headers={"Cache-Control": "public, max-age=3600"})

    return app

