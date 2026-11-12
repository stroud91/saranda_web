"""Public pages for partner businesses: the directory, a business's profile
with its listings, and the enquiry form guests use to reach it."""
from datetime import date, timedelta

from flask import Blueprint, abort, jsonify

from app.extensions import limiter
from app.models import Business, CarRental, Enquiry, Tour, db
from app.services import accounts, mailer, partners
from app.validation import Field, ValidationError, json_body

business_routes = Blueprint("businesses", __name__)


@business_routes.before_request
def _switch():
    if not partners.enabled():
        return jsonify({"error": "Not found"}), 404
    return None


def _business_or_404(slug):
    business = Business.query.filter_by(slug=slug[:80], status="approved").first()
    if not business:
        abort(404, description="Business not found")
    return business


@business_routes.get("/")
def list_businesses():
    out = []
    for business in Business.query.filter_by(status="approved").order_by(Business.name).all():
        listings = partners.public_listings(business)
        row = business.to_public_dict()
        row["counts"] = {key: len(rows) for key, rows in listings.items()}
        out.append(row)
    return jsonify({"businesses": out})


@business_routes.get("/<slug>")
def get_business(slug):
    business = _business_or_404(slug)
    return jsonify({"business": business.to_public_dict(), "listings": partners.public_listings(business)})


ENQUIRY_SCHEMA = {
    "kind": Field(choices=["general", "experience", "rental"], default="general"),
    "listing_id": Field("int", min=1),
    "name": Field(required=True, max_len=120),
    "email": Field("email", required=True, max_len=255),
    "phone": Field("phone", max_len=40),
    "start_date": Field("date", label="Date"),
    "end_date": Field("date", label="Return date"),
    "people": Field("int", min=1, max=60),
    "message": Field("text", required=True, max_len=2000),
    "website": Field(max_len=200),  # honeypot: humans never fill this
}


def _listing_for(business, kind, listing_id):
    """The public listing the question is about; it must belong to this business."""
    model, key = (Tour, "experiences") if kind == "experience" else (CarRental, "rentals")
    obj = model.query.filter(model.id == listing_id, model.business_id == business.id,
                             partners.public_filter(model)).first()
    if not obj or not partners.KINDS[key].is_on(obj):
        raise ValidationError({"listing_id": "That listing is no longer available"})
    return obj


@business_routes.post("/<slug>/enquiries")
@limiter.limit("8 per hour")
def send_enquiry(slug):
    """Ask a business a question. It answers the guest directly; nothing is charged."""
    business = _business_or_404(slug)
    data = json_body(ENQUIRY_SCHEMA)
    if data["website"]:
        return jsonify({"error": "Request rejected"}), 400
    today = date.today()
    start, end = data["start_date"], data["end_date"]
    if start and start < today:
        raise ValidationError({"start_date": "Pick a date from today onwards"})
    if start and start > today + timedelta(days=540):
        raise ValidationError({"start_date": "Pick a date within the next 18 months"})
    if end and (not start or end < start or end > start + timedelta(days=90)):
        raise ValidationError({"end_date": "The return date must be after the start, within 90 days"})

    subject, tour_id, car_id = "General question", None, None
    if data["kind"] != "general":
        if not data["listing_id"]:
            raise ValidationError({"listing_id": "Choose what you're asking about"})
        listing = _listing_for(business, data["kind"], data["listing_id"])
        if data["kind"] == "experience":
            subject, tour_id = listing.tour_name, listing.id
        else:
            subject, car_id = listing.car_model, listing.id

    enquiry = Enquiry(
        business_id=business.id, tour_id=tour_id, car_id=car_id, subject=subject, name=data["name"],
        email=data["email"].lower(), phone=data["phone"], start_date=start, end_date=end, people=data["people"],
        message=data["message"], user_id=getattr(accounts.current_user(), "id", None),
    )
    db.session.add(enquiry)
    db.session.commit()
    # Guest details only ever go to the owner's confirmed account address.
    if business.owner and business.owner.email_verified:
        mailer.deliver(mailer.enquiry_for_business, business.owner.email, enquiry.to_owner_dict(), business.name,
                       accounts.site_url())
    return jsonify(enquiry.to_public_dict()), 201
