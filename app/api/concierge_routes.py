from flask import Blueprint, jsonify, request

from app.extensions import limiter
from app.services import concierge
from app.validation import ValidationError, clean_text

concierge_routes = Blueprint("concierge", __name__)

MAX_MESSAGES = 16
MAX_CHARS = 1500


def _messages():
    body = request.get_json(silent=True) or {}
    raw = body.get("messages")
    if not isinstance(raw, list) or not raw:
        raise ValidationError({"messages": "Send at least one message"})
    raw = raw[-MAX_MESSAGES:]
    out = []
    for m in raw:
        if not isinstance(m, dict) or m.get("role") not in ("user", "assistant") or not isinstance(m.get("content"), str):
            raise ValidationError({"messages": "Each message needs a role and text content"})
        text = clean_text(m["content"], MAX_CHARS)
        if not text:
            continue
        if out and out[-1]["role"] == m["role"]:
            out[-1]["content"] += "\n\n" + text
        else:
            out.append({"role": m["role"], "content": text})
    while out and out[0]["role"] != "user":
        out.pop(0)
    if not out or out[-1]["role"] != "user":
        raise ValidationError({"messages": "The last message must be from the traveller"})
    return out


@concierge_routes.post("/")
@limiter.limit("12 per minute;120 per day")
def ask():
    """Ask the travel concierge. Body: {messages: [{role, content}]}"""
    return jsonify(concierge.answer(_messages()))
