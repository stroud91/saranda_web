from .db import add_prefix_for_prod, db, table_args, utcnow


class Review(db.Model):
    """A guest's review of a stay. There is at most one per booking, and only a
    guest whose stay has finished can write one."""

    __tablename__ = "reviews"
    __table_args__ = table_args()

    id = db.Column(db.Integer, primary_key=True)
    hotel_id = db.Column(db.Integer, db.ForeignKey(add_prefix_for_prod("hotels.id")), nullable=False, index=True)
    booking_id = db.Column(db.Integer, db.ForeignKey(add_prefix_for_prod("bookings.id")), nullable=False, unique=True)
    rating = db.Column(db.Integer, nullable=False)  # 1 to 5
    title = db.Column(db.String(120), nullable=True)
    text = db.Column(db.Text, nullable=False)
    author_name = db.Column(db.String(60), nullable=True)  # "Ana G."; cleared if the guest deletes their account
    stay_month = db.Column(db.String(7), nullable=True)  # "2027-06"
    lang = db.Column(db.String(2), nullable=True)
    status = db.Column(db.String(12), nullable=False, default="published")  # published | hidden
    hidden_reason = db.Column(db.String(300), nullable=True)
    reply = db.Column(db.Text, nullable=True)
    replied_at = db.Column(db.DateTime, nullable=True)
    created_at = db.Column(db.DateTime, default=utcnow)

    hotel = db.relationship("Hotel", lazy="joined")
    booking = db.relationship("Booking", lazy="select")

    def to_public_dict(self):
        return {"id": self.id, "rating": self.rating, "title": self.title, "text": self.text,
                "author": self.author_name or "A guest", "stay_month": self.stay_month, "lang": self.lang,
                "reply": self.reply, "replied_at": self.replied_at.isoformat() + "Z" if self.replied_at else None,
                "created_at": self.created_at.isoformat() + "Z" if self.created_at else None}

    def to_host_dict(self):
        out = self.to_public_dict()
        out.update({"status": self.status, "hidden_reason": self.hidden_reason, "hotel_id": self.hotel_id,
                    "hotel_name": self.hotel.hotel_name if self.hotel else None,
                    "business": self.hotel.business_brief() if self.hotel else None,
                    "reference": self.booking.reference if self.booking else None})
        return out
