"""Guest accounts: register, sign in/out, profile, password change and reset,
e-mail verification. See app/services/accounts.py for the security design."""
from flask import Blueprint, current_app, jsonify, request

from app.extensions import limiter
from app.models import User, db
from app.models.db import utcnow
from app.services import accounts, mailer, twofactor
from app.validation import Field, ValidationError, json_body, validate

auth_routes = Blueprint("auth", __name__)

GENERIC_LOGIN_ERROR = "Email or password is incorrect"


@auth_routes.before_request
def _accounts_switch():
    """ACCOUNTS_ENABLED=false turns the whole feature off, not just its buttons."""
    if current_app.config.get("ACCOUNTS_ENABLED", True):
        return None
    if request.endpoint == "auth.me":
        return jsonify({"user": None, "email_delivery": False})
    return jsonify({"error": "Not found"}), 404


def _password(body, key="password"):
    """Passwords are taken verbatim: never trimmed, truncated or normalised."""
    value = (body or {}).get(key)
    return value if isinstance(value, str) else ""


_deliver = mailer.deliver


def email_delivery():
    return mailer.configured() and accounts.site_url() is not None


def _send_verification(email, raw, base):
    mailer.send_action(
        email, "Confirm your email address", "Confirm your email",
        ["Welcome to Saranda Companion. Confirm this address so your bookings and trips are linked to your account.",
         "The link works for 48 hours. If you didn't create an account, you can ignore this message."],
        ("Confirm email", f"{base}/verify-email?token={raw}"))


def _send_reset(email, raw, base):
    mailer.send_action(
        email, "Reset your password", "Reset your password",
        ["Someone asked to reset the password for this account. The link works for one hour and can be used once.",
         "If that wasn't you, ignore this message — your password stays the same."],
        ("Choose a new password", f"{base}/reset-password?token={raw}"))


def _send_two_step_notice(email, on):
    what = "switched on" if on else "switched off"
    mailer.send_action(
        email, f"Two-step sign-in was {what}", f"Two-step sign-in was {what}",
        [f"Two-step sign-in was just {what} for your Saranda Companion account." + (" Other devices were signed out." if on else ""),
         f"If this wasn't you, change your password straight away and contact {current_app.config.get('CONTACT_EMAIL')}."])


def _send_changed(email):
    mailer.send_action(
        email, "Your password was changed", "Your password was changed",
        ["The password for your Saranda Companion account was just changed and other devices were signed out.",
         f"If this wasn't you, reset your password straight away and contact {current_app.config.get('CONTACT_EMAIL')}."])


def _queue_verification(user):
    if not email_delivery() or user.email_verified:
        return False
    raw = accounts.issue_token(user, "verify")
    _deliver(_send_verification, user.email, raw, accounts.site_url())
    return True


def _signed_in(user, remember=True, status=200, **extra):
    raw, _ = accounts.start_session(user, remember)
    db.session.commit()
    resp = jsonify({"user": user.to_dict(), **extra})
    accounts.set_session_cookie(resp, raw, remember and not user.is_admin)
    return resp, status


@auth_routes.get("/me")
def me():
    """Who is signed in (``user`` is null for visitors)."""
    user = accounts.current_user()
    return jsonify({"user": user.to_dict() if user else None, "email_delivery": email_delivery()})


@auth_routes.post("/register")
@limiter.limit("5 per hour;20 per day")
def register():
    """Create an account and sign in."""
    body = request.get_json(silent=True)
    data = validate({"name": Field(required=True, max_len=120), "email": Field("email", required=True, max_len=255),
                     "website": Field(max_len=200)}, body)
    if data["website"]:  # honeypot
        return jsonify({"error": "Request rejected"}), 400
    email = data["email"].lower()
    password = _password(body)
    problem = accounts.password_problem(password, email, data["name"])
    if problem:
        raise ValidationError({"password": problem})
    if User.query.filter_by(email=email).first():
        return jsonify({"error": "An account with this email already exists. Sign in, or reset your password.",
                        "fields": {"email": "Already registered"}}), 409
    user = User(username=email, email=email, name=data["name"], role="guest")
    user.set_password(password)
    db.session.add(user)
    db.session.flush()
    sent = _queue_verification(user)
    return _signed_in(user, True, 201, verification_sent=sent)


@auth_routes.post("/login")
@limiter.limit("10 per minute;60 per hour")
def login():
    """Sign in. Failures are throttled per address and never reveal whether it exists."""
    body = request.get_json(silent=True)
    data = validate({"email": Field("email", required=True, max_len=255), "remember": Field("bool", default=True)}, body)
    email = data["email"].lower()
    password = _password(body)
    key = accounts.throttle_key(email)
    wait = accounts.locked_for(key)
    if wait:
        resp = jsonify({"error": f"Too many attempts. Try again in {max(1, round(wait / 60))} minutes."})
        resp.headers["Retry-After"] = str(wait)
        return resp, 429
    user = User.query.filter_by(email=email).first()
    if not accounts.verify_password(user, password[:accounts.MAX_PASSWORD + 1]) or user.is_active is False:
        accounts.record_failure(key)
        return jsonify({"error": GENERIC_LOGIN_ERROR}), 401
    accounts.clear_failures(key)
    if user.needs_rehash():  # upgrade work factors transparently
        changed = user.password_changed_at
        user.set_password(password)
        user.password_changed_at = changed
    if twofactor.enabled(user):
        # The password was right, but nobody is signed in yet: the browser gets a short-lived
        # ticket and must come back with the code from the authenticator app.
        ticket = accounts.issue_token(user, "2fa")
        db.session.commit()
        return jsonify({"two_step": True, "ticket": ticket})
    old = accounts.current_session()
    if old:  # replace, don't stack, the session of whoever was signed in on this browser
        old.revoked_at = utcnow()
    return _signed_in(user, data["remember"])


@auth_routes.post("/login/code")
@limiter.limit("10 per minute;60 per hour")
def login_code():
    """Second step of signing in: the 6-digit code (or a recovery code). Wrong codes count
    against the same lockout as wrong passwords, so the code can't be guessed by trying."""
    data = json_body({"ticket": Field(required=True, max_len=128), "code": Field(required=True, max_len=40),
                      "remember": Field("bool", default=True)})
    token = accounts.peek_token(data["ticket"], "2fa")
    user = db.session.get(User, token.user_id) if token else None
    if not user or user.is_active is False or not twofactor.enabled(user):
        return jsonify({"error": "That sign-in has expired. Please start again.", "code": "expired"}), 401
    key = accounts.throttle_key(user.email)
    wait = accounts.locked_for(key)
    if wait:
        resp = jsonify({"error": f"Too many attempts. Try again in {max(1, round(wait / 60))} minutes."})
        resp.headers["Retry-After"] = str(wait)
        return resp, 429
    if not twofactor.passes(user, data["code"]):
        accounts.record_failure(key)
        return jsonify({"error": "That code isn't right. Check the app and try again.", "fields": {"code": "Incorrect"}}), 401
    token.used_at = utcnow()
    accounts.clear_failures(key)
    old = accounts.current_session()
    if old:
        old.revoked_at = utcnow()
    return _signed_in(user, data["remember"], codes_left=len(user.recovery_codes or []))


# ---- two-step sign-in: setting it up -------------------------------------------------
def _confirm_password(user):
    body = request.get_json(silent=True) or {}
    if not user.check_password(_password(body, "password")):
        raise ValidationError({"password": "Password is incorrect"})


@auth_routes.post("/two-step/setup")
@accounts.login_required
@limiter.limit("10 per hour")
def two_step_setup():
    """Start setting up (asks for the password again). Returns the secret to scan or type.
    Nothing changes for sign-in until a code from the app has been confirmed."""
    user = accounts.current_user()
    _confirm_password(user)
    if twofactor.enabled(user):
        return jsonify({"error": "Two-step sign-in is already on."}), 409
    secret = twofactor.begin(user)
    db.session.commit()
    link = twofactor.uri(user, secret)
    return jsonify({"secret": secret, "uri": link, "qr": twofactor.qr(link)})


@auth_routes.post("/two-step/enable")
@accounts.login_required
@limiter.limit("20 per hour")
def two_step_enable():
    """Confirm the app works by entering its code; switches two-step sign-in on."""
    user = accounts.current_user()
    data = json_body({"code": Field(required=True, max_len=12)})
    if twofactor.enabled(user) or not user.totp_secret:
        return jsonify({"error": "Start the setup again."}), 409
    if not twofactor.check(user, data["code"]):
        db.session.rollback()
        return jsonify({"error": "That code isn't right. Check the app and try again.", "fields": {"code": "Incorrect"}}), 400
    codes = twofactor.switch_on(user)
    accounts.revoke_sessions(user, keep_id=accounts.current_session().id)  # other devices sign in again, with a code
    db.session.commit()
    if mailer.configured():
        _deliver(_send_two_step_notice, user.email, True)
    return jsonify({"user": user.to_dict(), "recovery_codes": codes})


@auth_routes.post("/two-step/recovery-codes")
@accounts.login_required
@limiter.limit("10 per hour")
def two_step_new_codes():
    """Replace the recovery codes (the old ones stop working). Needs the password."""
    user = accounts.current_user()
    _confirm_password(user)
    if not twofactor.enabled(user):
        return jsonify({"error": "Two-step sign-in is off."}), 409
    codes = twofactor.new_recovery_codes(user)
    db.session.commit()
    return jsonify({"recovery_codes": codes})


@auth_routes.post("/two-step/disable")
@accounts.login_required
@limiter.limit("10 per hour")
def two_step_disable():
    """Switch two-step sign-in off. Needs the password and a current code (or a recovery code)."""
    user = accounts.current_user()
    _confirm_password(user)
    data = json_body({"code": Field(required=True, max_len=40)})
    if not twofactor.enabled(user):
        return jsonify({"error": "Two-step sign-in is already off."}), 409
    if user.is_admin and current_app.config.get("REQUIRE_TWO_STEP_FOR_HOSTS"):
        return jsonify({"error": "Host accounts on this site must keep two-step sign-in on."}), 409
    if not twofactor.passes(user, data["code"]):
        db.session.rollback()
        return jsonify({"error": "That code isn't right.", "fields": {"code": "Incorrect"}}), 400
    twofactor.switch_off(user)
    db.session.commit()
    if mailer.configured():
        _deliver(_send_two_step_notice, user.email, False)
    return jsonify({"user": user.to_dict()})


@auth_routes.post("/logout")
def logout():
    session = accounts.current_session()
    if session:
        session.revoked_at = utcnow()
        db.session.commit()
    resp = jsonify({"ok": True})
    accounts.clear_session_cookie(resp)
    return resp


@auth_routes.patch("/me")
@accounts.login_required
def update_me():
    user = accounts.current_user()
    data = json_body({"name": Field(required=True, max_len=120), "phone": Field("phone", max_len=20)})
    user.name, user.phone_number = data["name"], data["phone"] or None
    db.session.commit()
    return jsonify({"user": user.to_dict()})


@auth_routes.post("/password")
@accounts.login_required
@limiter.limit("10 per hour")
def change_password():
    """Change the password (needs the current one) and sign out every other device."""
    user = accounts.current_user()
    body = request.get_json(silent=True) or {}
    if not user.check_password(_password(body, "current_password")):
        return jsonify({"error": "Current password is incorrect", "fields": {"current_password": "Incorrect"}}), 400
    new = _password(body, "new_password")
    problem = accounts.password_problem(new, user.email, user.name)
    if problem:
        raise ValidationError({"new_password": problem})
    user.set_password(new)
    accounts.revoke_sessions(user, keep_id=accounts.current_session().id)
    db.session.commit()
    if mailer.configured():
        _deliver(_send_changed, user.email)
    return jsonify({"ok": True})


@auth_routes.post("/password/forgot")
@limiter.limit("5 per hour")
def forgot_password():
    """Always answers the same way, whether or not the address has an account."""
    data = json_body({"email": Field("email", required=True, max_len=255)})
    user = User.query.filter_by(email=data["email"].lower()).first()
    if user and user.is_active is not False and email_delivery():
        raw = accounts.issue_token(user, "reset")
        db.session.commit()
        _deliver(_send_reset, user.email, raw, accounts.site_url())
    return jsonify({"ok": True, "email_delivery": email_delivery()}), 202


@auth_routes.post("/password/reset")
@limiter.limit("10 per hour")
def reset_password():
    """Set a new password with a reset link's token; signs every device out.

    With two-step sign-in on, the link changes the password but signs nobody in: someone
    who got into the mailbox still needs the code from the authenticator app."""
    body = request.get_json(silent=True) or {}
    token = body.get("token")
    probe = accounts.consume_token(token, "reset")
    if not probe or probe.is_active is False:
        db.session.rollback()
        return jsonify({"error": "This link is invalid or has expired. Ask for a new one."}), 400
    new = _password(body)
    problem = accounts.password_problem(new, probe.email, probe.name)
    if problem:
        db.session.rollback()  # keep the token usable so the guest can try another password
        raise ValidationError({"password": problem})
    probe.set_password(new)
    probe.mark_verified()  # the link proved control of the inbox
    accounts.revoke_sessions(probe)
    accounts.clear_failures(accounts.throttle_key(probe.email))
    if twofactor.enabled(probe):
        old = accounts.current_session()
        if old:  # whoever was signed in on this browser is signed out too
            old.revoked_at = utcnow()
        db.session.commit()
        return jsonify({"ok": True, "two_step": True})
    return _signed_in(probe, True)


@auth_routes.post("/verify")
@limiter.limit("20 per hour")
def verify_email():
    token = (request.get_json(silent=True) or {}).get("token")
    user = accounts.consume_token(token, "verify")
    if not user:
        db.session.rollback()
        return jsonify({"error": "This link is invalid or has expired. Sign in to request a new one."}), 400
    user.mark_verified()
    db.session.commit()
    return jsonify({"ok": True, "email": user.email})


@auth_routes.post("/verify/resend")
@accounts.login_required
@limiter.limit("3 per hour")
def resend_verification():
    user = accounts.current_user()
    if user.email_verified:
        return jsonify({"ok": True, "already_verified": True})
    if not email_delivery():
        return jsonify({"error": "Email isn't set up on this site yet. Please contact us to verify your account."}), 503
    _queue_verification(user)
    db.session.commit()
    return jsonify({"ok": True})
