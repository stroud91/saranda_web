"""The signed-in guest's own data: bookings, guide requests, trips, devices,
data export and account deletion (GDPR access, portability and erasure)."""
import json

from flask import Blueprint, Response, jsonify, request
from sqlalchemy import and_, func, or_

from app.extensions import limiter
from app.models import Booking, Business, Enquiry, GuideBooking, TripPlan, UserSession, db
from app.models.db import utcnow
from app.services import accounts, partners

account_routes = Blueprint("account", __name__)


@account_routes.before_request
def _accounts_switch():
    from flask import current_app

    if not current_app.config.get("ACCOUNTS_ENABLED", True):
        return jsonify({"error": "Not found"}), 404
    return None


def _mine(model, email_column, user):
    """Rows created while signed in, plus earlier ones made with the same address —
    but only once that address is verified, so registering with someone else's
    e-mail never exposes their bookings."""
    owned = model.user_id == user.id
    if user.email_verified:
        return or_(owned, and_(model.user_id.is_(None), func.lower(email_column) == user.email))
    return owned


def _bookings(user):
    return Booking.query.filter(_mine(Booking, Booking.guest_email, user)).order_by(Booking.start_date.desc()).limit(200).all()


def _guide_requests(user):
    return (GuideBooking.query.filter(_mine(GuideBooking, GuideBooking.email, user))
            .order_by(GuideBooking.tour_date.desc()).limit(200).all())


def _enquiries(user):
    return (Enquiry.query.filter(_mine(Enquiry, Enquiry.email, user))
            .order_by(Enquiry.created_at.desc()).limit(200).all())


def _business_export(user):
    """The owner's own business profile and listings (not the requests guests sent them)."""
    business = Business.query.filter_by(owner_id=user.id).first()
    if not business:
        return None
    return {"profile": business.to_owner_dict(),
            "listings": {key: [partners.owner_view(kind, obj) for obj in partners.owned(kind, business)]
                         for key, kind in partners.KINDS.items()}}


def _trips(user):
    return TripPlan.query.filter_by(user_id=user.id).order_by(TripPlan.updated_at.desc()).limit(200).all()


def _trip_summary(plan):
    days = (plan.data or {}).get("days") or []
    return {"share_id": plan.share_id, "title": plan.title, "days": len(days),
            "stops": len({s for d in days for s in d.get("stops", [])}),
            "start_date": (plan.data or {}).get("start_date"),
            "updated_at": plan.updated_at.isoformat() + "Z" if plan.updated_at else None}


@account_routes.get("/overview")
@accounts.login_required
def overview():
    """Everything the account page shows, in one request."""
    user = accounts.current_user()
    return jsonify({
        "user": user.to_dict(),
        "bookings": [b.to_public_dict() for b in _bookings(user)],
        "guide_requests": [g.to_public_dict() for g in _guide_requests(user)],
        "enquiries": [e.to_public_dict() for e in _enquiries(user)],
        "trips": [_trip_summary(t) for t in _trips(user)],
        "has_business": Business.query.filter_by(owner_id=user.id).first() is not None,
    })


@account_routes.get("/sessions")
@accounts.login_required
def sessions():
    user, current = accounts.current_user(), accounts.current_session()
    rows = (UserSession.query.filter(UserSession.user_id == user.id, UserSession.revoked_at.is_(None),
                                     UserSession.expires_at > utcnow())
            .order_by(UserSession.last_seen_at.desc()).all())
    return jsonify({"sessions": [s.to_dict(current.id) for s in rows]})


@account_routes.delete("/sessions/<int:session_id>")
@accounts.login_required
def revoke_session(session_id):
    user = accounts.current_user()
    row = UserSession.query.filter_by(id=session_id, user_id=user.id).first()
    if not row:
        return jsonify({"error": "Not found"}), 404
    row.revoked_at = row.revoked_at or utcnow()
    db.session.commit()
    return jsonify({"ok": True})


@account_routes.post("/sessions/revoke-others")
@accounts.login_required
def revoke_others():
    accounts.revoke_sessions(accounts.current_user(), keep_id=accounts.current_session().id)
    db.session.commit()
    return jsonify({"ok": True})


@account_routes.get("/export")
@accounts.login_required
@limiter.limit("10 per hour")
def export():
    """A copy of the account's data as a JSON download."""
    user = accounts.current_user()
    data = {
        "exported_at": utcnow().isoformat() + "Z",
        "account": user.to_dict(),
        "bookings": [b.to_admin_dict() for b in _bookings(user)],
        "guide_requests": [g.to_admin_dict() for g in _guide_requests(user)],
        "enquiries": [{**e.to_owner_dict(), "business": e.business.name if e.business else None} for e in _enquiries(user)],
        "trips": [t.to_dict() for t in _trips(user)],
        "business": _business_export(user),
    }
    for row in data["bookings"]:
        for internal in ("id", "stripe_payment_intent_id", "payment_ref"):
            row.pop(internal, None)
    for row in data["guide_requests"]:
        row.pop("id", None)
    return Response(json.dumps(data, indent=2, ensure_ascii=False), mimetype="application/json",
                    headers={"Content-Disposition": 'attachment; filename="saranda-companion-account.json"'})


@account_routes.post("/delete")
@accounts.login_required
@limiter.limit("5 per hour")
def delete_account():
    """Erase the account. Bookings stay with the host (they are business records)
    but are unlinked from the account; saved trips are deleted. A business the
    account owns is closed: its listings come down and its contact details go."""
    user = accounts.current_user()
    password = (request.get_json(silent=True) or {}).get("password")
    if not isinstance(password, str) or not user.check_password(password):
        return jsonify({"error": "Password is incorrect", "fields": {"password": "Incorrect"}}), 400
    Booking.query.filter_by(user_id=user.id).update({"user_id": None}, synchronize_session=False)
    GuideBooking.query.filter_by(user_id=user.id).update({"user_id": None}, synchronize_session=False)
    Enquiry.query.filter_by(user_id=user.id).update({"user_id": None}, synchronize_session=False)
    business = Business.query.filter_by(owner_id=user.id).first()
    if business:
        partners.close(business)
        db.session.flush()
    TripPlan.query.filter_by(user_id=user.id).delete(synchronize_session=False)
    db.session.delete(user)
    db.session.commit()
    resp = jsonify({"ok": True})
    accounts.clear_session_cookie(resp)
    return resp
