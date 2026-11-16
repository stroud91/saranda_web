"""Uploading photos for listings. See app/services/uploads.py for how a file is checked."""
from flask import Blueprint, current_app, jsonify, request

from app.extensions import limiter
from app.models import Business, Upload, db
from app.services import accounts, partners, uploads

upload_routes = Blueprint("uploads", __name__)


def _count(business_id):
    owner = Upload.business_id.is_(None) if business_id is None else Upload.business_id == business_id
    return Upload.query.filter(owner).count()


@upload_routes.post("/")
@accounts.login_required
@limiter.limit("150 per hour")
def upload_photo():
    """One photo per request, as multipart field ``file``. ``scope`` says whose it is:
    "house" (the site's own listings, host only) or "business" (the signed-in owner's)."""
    # Browsers can't add this header to a cross-site form post, so its presence shows
    # the request came from our own page's script.
    if request.headers.get("X-Requested-With") != "fetch":
        return jsonify({"error": "Upload from the site's own form"}), 400
    user = accounts.current_user()
    scope = request.form.get("scope", "business")
    if scope == "house":
        if not user.is_admin:
            return jsonify({"error": "Not found"}), 404
        business_id = None
        limit = current_app.config.get("HOUSE_MAX_PHOTOS", 3000)
    else:
        business = Business.query.filter_by(owner_id=user.id).first() if partners.enabled() else None
        if not business or business.status in ("suspended", "closed"):
            return jsonify({"error": "Not found"}), 404
        if not user.email_verified:
            return jsonify({"error": "Confirm your email address first.", "code": "verify_email"}), 403
        business_id = business.id
        limit = current_app.config.get("PARTNER_MAX_PHOTOS", 300)
    if _count(business_id) >= limit:
        uploads.cleanup(older_than_hours=1, business_id=business_id)  # make room: drop photos never put on a listing
        if _count(business_id) >= limit:
            return jsonify({"error": f"You've reached the limit of {limit} photos. Remove some from your listings first."}), 409
    file = request.files.get("file")
    if not file:
        return jsonify({"error": "Choose a photo to upload"}), 400
    try:
        upload = uploads.save(file.stream, business_id, user.id)
    except uploads.UploadError as exc:
        return jsonify({"error": str(exc)}), exc.status
    db.session.commit()
    return jsonify(upload.to_dict()), 201
