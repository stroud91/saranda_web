from datetime import timedelta

from .db import add_prefix_for_prod, db, mask_email, new_reference, table_args, utcnow

HOLD_MINUTES = 30
ACTIVE_STATUSES = ("pending", "requested", "confirmed")


class Booking(db.Model):
    __tablename__ = "bookings"
    __table_args__ = table_args()

    id = db.Column(db.Integer, primary_key=True)
    reference = db.Column(db.String(20), unique=True, index=True, default=new_reference)
    user_id = db.Column(db.Integer, db.ForeignKey(add_prefix_for_prod("users.id")), nullable=True)
    tour_id = db.Column(db.Integer, db.ForeignKey(add_prefix_for_prod("tours.id")), nullable=True)
    hotel_id = db.Column(db.Integer, db.ForeignKey(add_prefix_for_prod("hotels.id")), nullable=True)
    car_id = db.Column(db.Integer, db.ForeignKey(add_prefix_for_prod("car_rentals.id")), nullable=True)
    start_date = db.Column(db.DateTime, nullable=False)
    end_date = db.Column(db.DateTime, nullable=False)
    nights = db.Column(db.Integer, nullable=True)
    total_cost = db.Column(db.Numeric(10, 2), nullable=False)
    currency = db.Column(db.String(3), default="EUR")
    created_at = db.Column(db.DateTime, default=utcnow)
    updated_at = db.Column(db.DateTime, default=utcnow, onupdate=utcnow)
    # pending (awaiting payment) | requested (host to confirm) | confirmed | cancelled | expired
    status = db.Column(db.String(50), default="pending")
    payment_status = db.Column(db.String(30), default="unpaid")
    hold_expires_at = db.Column(db.DateTime, nullable=True)

    guest_name = db.Column(db.String(255), nullable=True)
    guest_email = db.Column(db.String(255), nullable=True)
    guest_phone = db.Column(db.String(50), nullable=True)
    guest_count = db.Column(db.Integer, nullable=True)
    notes = db.Column(db.Text, nullable=True)
    stripe_payment_intent_id = db.Column(db.String(255), nullable=True, index=True)

    def start_hold(self):
        self.hold_expires_at = utcnow() + timedelta(minutes=HOLD_MINUTES)

    @property
    def is_blocking(self):
        """Does this booking currently block the dates?"""
        if self.status in ("confirmed", "requested"):
            return True
        if self.status == "pending":
            return self.hold_expires_at is None or self.hold_expires_at > utcnow()
        return False

    def to_public_dict(self):
        """Safe to show to whoever holds the reference (PII masked)."""
        return {
            "reference": self.reference,
            "status": self.status,
            "payment_status": self.payment_status,
            "hotel_id": self.hotel_id,
            "hotel_name": self.hotel.hotel_name if self.hotel else None,
            "start_date": self.start_date.date().isoformat() if self.start_date else None,
            "end_date": self.end_date.date().isoformat() if self.end_date else None,
            "nights": self.nights,
            "guest_count": self.guest_count,
            "total_cost": float(self.total_cost),
            "currency": self.currency or "EUR",
            "guest_first_name": (self.guest_name or "").split(" ")[0] or None,
            "guest_email_masked": mask_email(self.guest_email),
            "hold_expires_at": self.hold_expires_at.isoformat() + "Z" if self.hold_expires_at else None,
            "created_at": self.created_at.isoformat() + "Z" if self.created_at else None,
        }

    def to_admin_dict(self):
        out = self.to_public_dict()
        out.update({"id": self.id, "guest_name": self.guest_name, "guest_email": self.guest_email,
                    "guest_phone": self.guest_phone, "notes": self.notes,
                    "stripe_payment_intent_id": self.stripe_payment_intent_id})
        return out
