"""Guest accounts: sessions, sign-in throttling, password rules and one-time tokens.

Design notes
- The browser holds a random 256-bit session token in an HttpOnly, SameSite=Lax
  cookie (``__Host-`` prefixed and Secure over HTTPS). The database stores only
  its SHA-256 digest, so a database leak does not yield usable sessions, and any
  session can be revoked server-side (sign out everywhere, password change).
- Failed sign-ins are counted per e-mail address whether or not the account
  exists, and a dummy hash is verified for unknown addresses, so neither the
  response nor its timing reveals which addresses have accounts.
- Verification and reset links carry single-use tokens that are stored hashed
  and expire quickly.
"""
import hashlib
import hmac
import logging
import secrets
from datetime import timedelta
from functools import wraps

from flask import current_app, g, jsonify, request
from werkzeug.security import check_password_hash, generate_password_hash

from app.models import AuthToken, LoginThrottle, User, UserSession, db
from app.models.db import utcnow
from app.models.user import hash_method, hash_token

from . import upstream

log = logging.getLogger(__name__)

REMEMBER_DAYS = 30          # sliding lifetime of a "keep me signed in" session
ABSOLUTE_DAYS = 90          # ...but never longer than this since sign-in
SHORT_HOURS = 24            # session without "keep me signed in"
ADMIN_HOURS = 12            # host sessions are short-lived
TOUCH_SECONDS = 300         # how often last_seen_at is refreshed

VERIFY_TTL = timedelta(hours=48)
RESET_TTL = timedelta(hours=1)
TWO_STEP_TTL = timedelta(minutes=5)   # time to type the authenticator code after the password

MAX_FAILURES = 5            # per window, per e-mail address
WINDOW = timedelta(minutes=15)
LOCK_SHORT = timedelta(minutes=15)
LOCK_LONG = timedelta(hours=1)

MIN_PASSWORD = 10
MAX_PASSWORD = 128

# Passwords of 10+ characters that still top breach lists (the online breach
# check below covers the long tail; this list works offline).
COMMON = frozenset("""
1234567890 12345678910 0123456789 0987654321 1234512345 1111111111 0000000000 1q2w3e4r5t 1qaz2wsx3edc
qwertyuiop qwerty12345 qwerty123456 qwertyuiop123 asdfghjkl; asdfghjkl1 zxcvbnm123 1234qwerasdf
password12 password123 password1234 passw0rd123 password!1 mypassword iloveyou123 iloveyou12 welcome123
letmein123 football123 baseball123 superman123 princess123 sunshine123 starwars123 pokemon123 dragon12345
administrator admin12345 changeme123 abcdefghij abc123abc123 abcd123456 a1b2c3d4e5 q1w2e3r4t5 trustno1234
monkey12345 master12345 michael123 jennifer123 liverpool123 chelsea12345 arsenal12345 manchester1 juventus123
albania123 albania1234 shqiperia1 shqiperia123 saranda123 saranda1234 sarande123 megrooms123 tirana12345
""".split())


class AccountError(Exception):
    def __init__(self, message, status=400, field=None):
        super().__init__(message)
        self.status = status
        self.field = field


# ---- cookies ---------------------------------------------------------------
def _secure():
    return bool(current_app.config.get("FORCE_HTTPS")) or request.is_secure


def cookie_name():
    # The __Host- prefix makes browsers refuse the cookie unless it is Secure,
    # host-only and Path=/, which blocks sub-domain cookie injection.
    return "__Host-sc_session" if _secure() else "sc_session"


def set_session_cookie(resp, raw, remember):
    resp.set_cookie(cookie_name(), raw, max_age=REMEMBER_DAYS * 86400 if remember else None,
                    secure=_secure(), httponly=True, samesite="Lax", path="/")


def clear_session_cookie(resp):
    for name, secure in (("__Host-sc_session", True), ("sc_session", False)):
        resp.set_cookie(name, "", max_age=0, secure=secure, httponly=True, samesite="Lax", path="/")


# ---- sessions --------------------------------------------------------------
def start_session(user, remember=True):
    """Create a session row and return the raw token for the cookie."""
    raw = secrets.token_urlsafe(32)
    now = utcnow()
    if user.is_admin:
        expires, remember = now + timedelta(hours=ADMIN_HOURS), False
    elif remember:
        expires = now + timedelta(days=REMEMBER_DAYS)
    else:
        expires = now + timedelta(hours=SHORT_HOURS)
    session = UserSession(user_id=user.id, token_hash=hash_token(raw), remember=remember, expires_at=expires,
                          user_agent=_device_label(request.headers.get("User-Agent", "")))
    user.last_login_at = now
    db.session.add(session)
    # Housekeeping: drop this user's long-dead sessions.
    UserSession.query.filter(UserSession.user_id == user.id,
                             UserSession.expires_at < now - timedelta(days=7)).delete(synchronize_session=False)
    return raw, session


def _device_label(ua):
    """A short, human-readable device name; the raw User-Agent is not stored."""
    ua = ua[:400]
    system = next((label for key, label in (("iPhone", "iPhone"), ("iPad", "iPad"), ("Android", "Android"),
                                            ("Windows", "Windows"), ("Macintosh", "Mac"), ("Linux", "Linux"))
                   if key in ua), "Unknown device")
    browser = next((label for key, label in (("Edg/", "Edge"), ("OPR/", "Opera"), ("Firefox/", "Firefox"),
                                             ("Chrome/", "Chrome"), ("Safari/", "Safari")) if key in ua), "")
    return f"{browser} on {system}" if browser else system


def _resolve():
    raw = request.cookies.get("__Host-sc_session") or request.cookies.get("sc_session")
    if not raw or len(raw) > 128:
        return None, None
    session = UserSession.query.filter_by(token_hash=hash_token(raw)).first()
    if not session or not session.active:
        return None, None
    user = db.session.get(User, session.user_id)
    if not user or user.is_active is False:
        return None, None
    now = utcnow()
    if (now - (session.last_seen_at or session.created_at)).total_seconds() > TOUCH_SECONDS:
        session.last_seen_at = now
        if session.remember:  # sliding expiry with an absolute cap
            cap = session.created_at + timedelta(days=ABSOLUTE_DAYS)
            session.expires_at = min(cap, now + timedelta(days=REMEMBER_DAYS))
        db.session.commit()
    return user, session


def current_user():
    if "account_user" not in g:
        g.account_user, g.account_session = _resolve()
    return g.account_user


def current_session():
    current_user()
    return g.account_session


def login_required(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        if not current_user():
            return jsonify({"error": "Please sign in"}), 401
        return fn(*args, **kwargs)
    return wrapper


def revoke_sessions(user, keep_id=None):
    q = UserSession.query.filter(UserSession.user_id == user.id, UserSession.revoked_at.is_(None))
    if keep_id is not None:
        q = q.filter(UserSession.id != keep_id)
    q.update({"revoked_at": utcnow()}, synchronize_session=False)


# ---- sign-in throttling ------------------------------------------------------
def throttle_key(email):
    secret = current_app.config["SECRET_KEY"].encode()
    return hmac.new(secret, b"login:" + email.strip().lower().encode(), hashlib.sha256).hexdigest()


def locked_for(key):
    """Seconds until sign-in is allowed again for this address (0 = allowed now)."""
    row = db.session.get(LoginThrottle, key)
    if row and row.locked_until and row.locked_until > utcnow():
        return int((row.locked_until - utcnow()).total_seconds()) + 1
    return 0


def record_failure(key):
    now = utcnow()
    row = db.session.get(LoginThrottle, key)
    if not row:
        row = LoginThrottle(key_hash=key, failures=0, window_start=now)
        db.session.add(row)
    if now - row.window_start > LOCK_LONG:
        row.failures, row.window_start = 0, now
    row.failures += 1
    if row.failures >= MAX_FAILURES * 2:
        row.locked_until = now + LOCK_LONG
    elif row.failures >= MAX_FAILURES and now - row.window_start <= WINDOW + LOCK_SHORT:
        row.locked_until = now + LOCK_SHORT
    db.session.commit()


def clear_failures(key):
    row = db.session.get(LoginThrottle, key)
    if row:
        db.session.delete(row)


_dummy = {}


def verify_password(user, password):
    """Check a password in (near) constant time whether or not the user exists."""
    if user is None:
        method = hash_method()
        if method not in _dummy:
            _dummy[method] = generate_password_hash(secrets.token_urlsafe(16), method=method, salt_length=16)
        check_password_hash(_dummy[method], password)
        return False
    return user.check_password(password)


# ---- password rules ------------------------------------------------------------
def password_problem(password, email="", name=""):
    """Return why a password is not acceptable, or None. Length beats complexity rules."""
    if not isinstance(password, str) or len(password) < MIN_PASSWORD:
        return f"Use at least {MIN_PASSWORD} characters — a short sentence works well"
    if len(password) > MAX_PASSWORD:
        return f"Use at most {MAX_PASSWORD} characters"
    low = password.lower()
    if low in COMMON or len(set(low)) < 4:
        return "That password is too common. Try a short sentence instead"
    local = (email or "").split("@")[0].lower()
    if (len(local) >= 4 and local in low) or (name and len(name.strip()) >= 4 and name.strip().lower() in low):
        return "Don't include your name or email in the password"
    if current_app.config.get("PASSWORD_BREACH_CHECK") and breached(password):
        return "That password has appeared in a data breach. Please choose a different one"
    return None


def breached(password):
    """Have I Been Pwned range query (k-anonymity: only 5 hash characters leave the server)."""
    digest = hashlib.sha1(password.encode()).hexdigest().upper()  # noqa: S324 - protocol requires SHA-1
    try:
        body = upstream.request_text("GET", f"https://api.pwnedpasswords.com/range/{digest[:5]}",
                                     headers={"Add-Padding": "true"}, timeout=(2, 3))
    except upstream.UpstreamError:
        return False  # never block sign-up because a third party is down
    for line in body.splitlines():
        suffix, _, count = line.partition(":")
        if suffix.strip() == digest[5:] and count.strip() not in ("", "0"):
            return True
    return False


# ---- one-time tokens ------------------------------------------------------------
def issue_token(user, purpose):
    """Create a fresh single-use token (older ones for the same purpose stop working)."""
    AuthToken.query.filter_by(user_id=user.id, purpose=purpose, used_at=None).delete(synchronize_session=False)
    raw = secrets.token_urlsafe(32)
    ttl = {"verify": VERIFY_TTL, "2fa": TWO_STEP_TTL}.get(purpose, RESET_TTL)
    db.session.add(AuthToken(user_id=user.id, purpose=purpose, token_hash=hash_token(raw),
                             expires_at=utcnow() + ttl))
    return raw


def peek_token(raw, purpose):
    """A valid, unused token without marking it used (the caller does that once its check passes)."""
    if not isinstance(raw, str) or not 20 <= len(raw) <= 128:
        return None
    token = AuthToken.query.filter_by(token_hash=hash_token(raw), purpose=purpose).first()
    if not token or token.used_at is not None or token.expires_at < utcnow():
        return None
    return token


def consume_token(raw, purpose):
    """Return the user for a valid token and mark it used; None otherwise."""
    if not isinstance(raw, str) or not 20 <= len(raw) <= 128:
        return None
    token = AuthToken.query.filter_by(token_hash=hash_token(raw), purpose=purpose).first()
    if not token or token.used_at is not None or token.expires_at < utcnow():
        return None
    token.used_at = utcnow()
    return db.session.get(User, token.user_id)


def site_url():
    """Base URL for links in e-mails.

    Never derived from the request in production: a forged Host header must
    not be able to point a password-reset link at an attacker's domain.
    """
    base = (current_app.config.get("PUBLIC_BASE_URL") or "").rstrip("/")
    if base:
        return base
    if current_app.config.get("IS_PRODUCTION"):
        return None
    return request.host_url.rstrip("/")
