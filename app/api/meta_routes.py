from flask import Blueprint, current_app, jsonify
from sqlalchemy import text

from app.data import essentials
from app.models import db
from app.services import payments

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
        "payments": {"enabled": payments.enabled(), "publishable_key": cfg.get("STRIPE_PUBLISHABLE_KEY")},
        "concierge": {"enabled": cfg.get("CONCIERGE_ENABLED", True), "ai": bool(cfg.get("ANTHROPIC_API_KEY"))},
        "google_places": bool(cfg.get("GOOGLE_MAPS_API_KEY")),
        "road_geometry": bool(cfg.get("OSRM_URL")),
        "whatsapp": cfg.get("WHATSAPP_NUMBER") or None,
        "contact_email": cfg.get("CONTACT_EMAIL"),
        "edition": essentials.EDITION,
        "last_reviewed": essentials.LAST_REVIEWED,
    })
