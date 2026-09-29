import hashlib
import hmac
import secrets

from .db import db, table_args, utcnow


def _hash_key(key):
    return hashlib.sha256(key.encode()).hexdigest()


class TripPlan(db.Model):
    """A saved, shareable trip.

    Anyone with the ``share_id`` can view it; only the holder of the
    ``edit_key`` (returned once at creation, stored hashed) can change it.
    """

    __tablename__ = "trip_plans"
    __table_args__ = table_args()

    id = db.Column(db.Integer, primary_key=True)
    share_id = db.Column(db.String(32), unique=True, nullable=False, index=True,
                         default=lambda: secrets.token_urlsafe(12))
    edit_key_hash = db.Column(db.String(64), nullable=False)
    title = db.Column(db.String(120), nullable=False)
    data = db.Column(db.JSON, nullable=False)
    created_at = db.Column(db.DateTime, default=utcnow)
    updated_at = db.Column(db.DateTime, default=utcnow, onupdate=utcnow)

    @classmethod
    def create(cls, title, data):
        key = secrets.token_urlsafe(24)
        plan = cls(title=title, data=data, edit_key_hash=_hash_key(key))
        return plan, key

    def check_key(self, key):
        return bool(key) and hmac.compare_digest(self.edit_key_hash, _hash_key(key))

    def to_dict(self):
        return {
            "share_id": self.share_id,
            "title": self.title,
            "data": self.data,
            "created_at": self.created_at.isoformat() + "Z" if self.created_at else None,
            "updated_at": self.updated_at.isoformat() + "Z" if self.updated_at else None,
        }
