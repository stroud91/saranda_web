from flask import Blueprint, current_app, jsonify, request
from sqlalchemy import text

from app.data import essentials
from app.extensions import limiter
from app.models import Guide, db
from app.services import accounts, cancellations, checkout, mailer, partners, payments, stats
from app.validation import Field, json_body

meta_routes = Blueprint("meta", __name__)


@meta_routes.get("/health")
def health():
    """Liveness + database check."""
    try:
        db.session.execute(text("SELECT 1"))
        ok = True
    except Exception:
        ok = False
    return jsonify({"status": "ok" if ok else "degraded", "database": ok}), 200 if ok else 503


@meta_routes.get("/config")
def public_config():
    """Feature flags and public keys the frontend needs."""
    cfg = current_app.config
    return jsonify({
        "payments": {"enabled": payments.enabled(), "publishable_key": cfg.get("STRIPE_PUBLISHABLE_KEY"),
                     "methods": checkout.methods(), "deposit_percent": checkout.deposit_percent()},
        "auth": {"enabled": bool(cfg.get("ACCOUNTS_ENABLED", True)),
                 "email": mailer.configured() and accounts.site_url() is not None},
        # Can local businesses sign up and list their own stays, rentals and activities?
        "partners": partners.enabled(),
        "concierge": {"enabled": cfg.get("CONCIERGE_ENABLED", True), "ai": bool(cfg.get("ANTHROPIC_API_KEY"))},
        # False until the host adds a real guide: the site then hides the guide directory.
        "guides": db.session.query(Guide.listed().exists()).scalar(),
        "google_places": bool(cfg.get("GOOGLE_MAPS_API_KEY")),
        "road_geometry": bool(cfg.get("OSRM_URL")),
        "whatsapp": cfg.get("WHATSAPP_NUMBER") or None,
        "contact_email": cfg.get("CONTACT_EMAIL"),
        "retention_months": cfg.get("MESSAGE_RETENTION_MONTHS", 24),
        "cancellation": cancellations.policy(),
        "reviews": bool(cfg.get("REVIEWS_ENABLED", True)),
        "stats": stats.enabled(),
        # For the privacy policy: how long backups are kept, and whether a copy is stored elsewhere.
        "backup_months": int(cfg.get("BACKUP_KEEP_MONTHLY", 6)),
        "backup_offsite": bool(cfg.get("BACKUP_UPLOAD_URL")),
        "edition": essentials.EDITION,
        "last_reviewed": essentials.LAST_REVIEWED,
    })


@meta_routes.post("/hit")
@limiter.limit("240 per hour")
def hit():
    """Count one page view (see services/stats.py). Sets no cookie and keeps nothing about the visitor.
    The host's own visits are left out, and so is anyone whose browser asks not to be tracked."""
    data = json_body({"path": Field(required=True, max_len=200), "referrer": Field(max_len=500), "lang": Field(max_len=5)})
    user = accounts.current_user()
    opted_out = request.headers.get("Sec-GPC") == "1" or request.headers.get("DNT") == "1"
    if not opted_out and not (user and user.is_admin):
        stats.record(data["path"], referrer=data["referrer"] or "", lang=data["lang"] or "en", ip=request.remote_addr or "",
                     agent=request.headers.get("User-Agent", "")[:300], own_host=request.host)
    return "", 204
