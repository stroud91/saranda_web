"""Two-step sign-in with an authenticator app (TOTP, RFC 6238).

After the password, the account asks for the 6-digit code that an app such as
Google Authenticator, Microsoft Authenticator, 1Password or Aegis shows. A
stolen or guessed password is then not enough to get in.

- The shared secret is stored encrypted with a key derived from SECRET_KEY, so
  a copy of the database alone does not reveal it.
- A code is accepted once: the time step it belongs to is remembered, so a code
  seen over someone's shoulder can't be replayed.
- Ten single-use recovery codes cover a lost phone. Only their hashes are stored.
- Wrong codes count against the same per-address lockout as wrong passwords.
"""
import base64
import hashlib
import hmac
import secrets
import struct
import time
from urllib.parse import quote

from cryptography.fernet import Fernet, InvalidToken
from flask import current_app

from app.models.db import utcnow

ISSUER = "Saranda Companion"
STEP = 30  # seconds a code lasts
DIGITS = 6
DRIFT = 1  # accept the code before and after the current one (clocks are never exact)
RECOVERY_CODES = 10


def _fernet():
    key = hashlib.sha256(b"two-step-sign-in:" + current_app.config["SECRET_KEY"].encode()).digest()
    return Fernet(base64.urlsafe_b64encode(key))


def new_secret():
    """160 random bits, in the base32 form authenticator apps take."""
    return base64.b32encode(secrets.token_bytes(20)).decode()


def seal(secret):
    return _fernet().encrypt(secret.encode()).decode()


def unseal(sealed):
    try:
        return _fernet().decrypt((sealed or "").encode()).decode()
    except (InvalidToken, ValueError):
        return None  # SECRET_KEY changed, or the value was tampered with


def code_at(secret, step):
    """The code for one 30-second time step."""
    digest = hmac.new(base64.b32decode(secret), struct.pack(">Q", step), hashlib.sha1).digest()
    offset = digest[-1] & 0x0F
    number = struct.unpack(">I", digest[offset:offset + 4])[0] & 0x7FFFFFFF
    return str(number % 10 ** DIGITS).zfill(DIGITS)


def current_step(now=None):
    return int((now if now is not None else time.time()) // STEP)


def _matching_step(secret, code, now=None):
    code = "".join(ch for ch in str(code or "") if ch.isdigit())
    if len(code) != DIGITS:
        return None
    here, found = current_step(now), None
    for step in range(here - DRIFT, here + DRIFT + 1):  # every candidate is checked, in constant time
        if hmac.compare_digest(code_at(secret, step), code):
            found = step
    return found


def enabled(user):
    return bool(user and user.totp_enabled_at and user.totp_secret)


def begin(user):
    """Start setting up: a fresh secret, kept but not yet switched on."""
    secret = new_secret()
    user.totp_secret, user.totp_enabled_at, user.totp_last_step = seal(secret), None, None
    return secret


def uri(user, secret):
    label = quote(f"{ISSUER}:{user.email}")
    return f"otpauth://totp/{label}?secret={secret}&issuer={quote(ISSUER)}&algorithm=SHA1&digits={DIGITS}&period={STEP}"


def qr(text):
    try:
        import segno

        return segno.make(text, error="m").svg_data_uri(scale=5, border=2, dark="#041f2e", light="#ffffff")
    except Exception:  # the secret can always be typed by hand
        return None


def check(user, code, now=None):
    """Is this the right code for the user's secret, and not one already used?"""
    secret = unseal(user.totp_secret) if user and user.totp_secret else None
    if not secret:
        return False
    step = _matching_step(secret, code, now)
    if step is None or (user.totp_last_step is not None and step <= user.totp_last_step):
        return False
    user.totp_last_step = step
    return True


def switch_on(user):
    """Turn two-step sign-in on and hand back the recovery codes (shown once)."""
    user.totp_enabled_at = utcnow()
    return new_recovery_codes(user)


def switch_off(user):
    user.totp_secret = user.totp_enabled_at = user.totp_last_step = user.recovery_codes = None


def _hash(code):
    return hashlib.sha256(_tidy(code).encode()).hexdigest()


def _tidy(code):
    return "".join(ch for ch in str(code or "").lower() if ch.isalnum())


def new_recovery_codes(user):
    codes = ["-".join(secrets.token_hex(2) for _ in range(3)) for _ in range(RECOVERY_CODES)]  # 48 random bits each
    user.recovery_codes = [_hash(c) for c in codes]
    return codes


def use_recovery_code(user, code):
    """Accept a recovery code once. Returns True if it was valid."""
    stored = list(user.recovery_codes or [])
    if len(_tidy(code)) != 12 or not stored:
        return False
    given, hit = _hash(code), None
    for item in stored:
        if hmac.compare_digest(item, given):
            hit = item
    if hit is None:
        return False
    stored.remove(hit)
    user.recovery_codes = stored
    return True


def passes(user, code):
    """A 6-digit code from the app, or one of the recovery codes."""
    return check(user, code) or use_recovery_code(user, code)
