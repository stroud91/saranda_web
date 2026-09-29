from flask import Blueprint, jsonify

from app.extensions import limiter
from app.models import ContactMessage, db
from app.validation import Field, json_body

contact_routes = Blueprint("contact", __name__)


@contact_routes.post("/")
@limiter.limit("5 per hour")
def send_message():
    data = json_body({
        "name": Field(required=True, max_len=120),
        "email": Field("email", required=True, max_len=255),
        "topic": Field(choices=["stay", "guide", "trip", "general"], default="general"),
        "message": Field("text", required=True, max_len=3000),
        "website": Field(max_len=200),  # honeypot
    })
    if data.pop("website"):
        return jsonify({"ok": True}), 202  # silently drop bots
    db.session.add(ContactMessage(**data))
    db.session.commit()
    return jsonify({"ok": True}), 202
