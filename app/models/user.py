import hashlib
import hmac

from flask import current_app
from werkzeug.security import check_password_hash, generate_password_hash

from .db import add_prefix_for_prod, db, table_args, utcnow

# OWASP-recommended scrypt work factors (N=2^15, r=8, p=3 ≈ 32 MB, ~0.2 s).
DEFAULT_HASH_METHOD = "scrypt:32768:8:3"


def hash_method():
    try:
        return current_app.config.get("PASSWORD_HASH_METHOD") or DEFAULT_HASH_METHOD
    except RuntimeError:
        return DEFAULT_HASH_METHOD


class User(db.Model):
    """A guest (or host) account. Passwords are stored only as salted scrypt hashes."""

    __tablename__ = "users"
    __table_args__ = table_args()

    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(255), nullable=False, unique=True)  # legacy column; mirrors email
    email = db.Column(db.String(255), nullable=False, unique=True)
    name = db.Column(db.String(120), nullable=True)
    password_hash = db.Column(db.String(255), nullable=False)
    phone_number = db.Column(db.String(20))
    role = db.Column(db.String(50), default="guest")  # guest | admin (admin is only set from the CLI)
    is_verified = db.Column(db.Boolean(), default=False)
    is_active = db.Column(db.Boolean(), default=True, nullable=True)
    email_verified_at = db.Column(db.DateTime, nullable=True)
    last_login_at = db.Column(db.DateTime, nullable=True)
    password_changed_at = db.Column(db.DateTime, nullable=True)
    clerk_user_id = db.Column(db.String(64), unique=True, index=True, nullable=True)
    created_at = db.Column(db.DateTime, default=utcnow)
    updated_at = db.Column(db.DateTime, default=utcnow, onupdate=utcnow)

    bookings = db.relationship("Booking", backref="user", lazy=True)
    tours_created = db.relationship("Tour", backref="creator", lazy=True)
    sessions = db.relationship("UserSession", backref="user", lazy=True, cascade="all, delete-orphan")
    tokens = db.relationship("AuthToken", backref="user", lazy=True, cascade="all, delete-orphan")

    @property
    def password(self):
        raise AttributeError("password is write-only")

    @password.setter
    def password(self, password):
        self.set_password(password)

    def set_password(self, password):
        self.password_hash = generate_password_hash(password, method=hash_method(), salt_length=16)
        self.password_changed_at = utcnow()

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)

    def needs_rehash(self):
        """True when the stored hash uses older work factors than the current ones."""
        return not (self.password_hash or "").startswith(hash_method() + "$")

    @property
    def email_verified(self):
        return self.email_verified_at is not None

    def mark_verified(self):
        if not self.email_verified_at:
            self.email_verified_at = utcnow()
        self.is_verified = True

    @property
    def is_admin(self):
        """Hosts: role set from the CLI, or an allow-listed address that has proved it owns the inbox."""
        if self.is_active is False:
            return False
        if self.role == "admin":
            return True
        return self.email_verified and self.email in current_app.config.get("ADMIN_EMAILS", [])

    def to_dict(self):
        return {
            "id": self.id,
            "email": self.email,
            "name": self.name or "",
            "phone": self.phone_number or "",
            "email_verified": self.email_verified,
            "is_admin": self.is_admin,
            "created_at": self.created_at.isoformat() + "Z" if self.created_at else None,
        }


def hash_token(raw):
    """Tokens (sessions, reset links) are stored only as SHA-256 digests."""
    return hashlib.sha256(raw.encode()).hexdigest()


class UserSession(db.Model):
    """A signed-in browser. The cookie holds a random token; only its hash is stored."""

    __tablename__ = "user_sessions"
    __table_args__ = table_args()

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey(add_prefix_for_prod("users.id"), ondelete="CASCADE"),
                        nullable=False, index=True)
    token_hash = db.Column(db.String(64), nullable=False, unique=True, index=True)
    user_agent = db.Column(db.String(200), nullable=True)
    remember = db.Column(db.Boolean(), default=True)
    created_at = db.Column(db.DateTime, default=utcnow)
    last_seen_at = db.Column(db.DateTime, default=utcnow)
    expires_at = db.Column(db.DateTime, nullable=False)
    revoked_at = db.Column(db.DateTime, nullable=True)

    @property
    def active(self):
        return self.revoked_at is None and self.expires_at > utcnow()

    def to_dict(self, current_id=None):
        return {
            "id": self.id,
            "device": self.user_agent or "Unknown device",
            "created_at": self.created_at.isoformat() + "Z",
            "last_seen_at": self.last_seen_at.isoformat() + "Z" if self.last_seen_at else None,
            "current": self.id == current_id,
        }


class AuthToken(db.Model):
    """Single-use, short-lived token for email verification or a password reset."""

    __tablename__ = "auth_tokens"
    __table_args__ = table_args()

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey(add_prefix_for_prod("users.id"), ondelete="CASCADE"),
                        nullable=False, index=True)
    purpose = db.Column(db.String(20), nullable=False)  # verify | reset
    token_hash = db.Column(db.String(64), nullable=False, unique=True, index=True)
    created_at = db.Column(db.DateTime, default=utcnow)
    expires_at = db.Column(db.DateTime, nullable=False)
    used_at = db.Column(db.DateTime, nullable=True)

    def matches(self, raw):
        return hmac.compare_digest(self.token_hash, hash_token(raw))


class LoginThrottle(db.Model):
    """Failed sign-in counter per (hashed) email address, whether or not the account exists."""

    __tablename__ = "login_throttles"
    __table_args__ = table_args()

    key_hash = db.Column(db.String(64), primary_key=True)
    failures = db.Column(db.Integer, default=0, nullable=False)
    window_start = db.Column(db.DateTime, default=utcnow, nullable=False)
    locked_until = db.Column(db.DateTime, nullable=True)
