from .db import add_prefix_for_prod, db, table_args, utcnow


class Tour(db.Model):
    __tablename__ = "tours"
    __table_args__ = table_args()

    id = db.Column(db.Integer, primary_key=True)
    tour_name = db.Column(db.String(255), nullable=False)
    description = db.Column(db.Text, nullable=False)
    price = db.Column(db.Numeric(10, 2), nullable=False)
    start_date = db.Column(db.DateTime, nullable=False)
    end_date = db.Column(db.DateTime, nullable=False)
    created_by = db.Column(db.Integer, db.ForeignKey(add_prefix_for_prod("users.id")), nullable=True)
    created_at = db.Column(db.DateTime, default=utcnow)
    updated_at = db.Column(db.DateTime, default=utcnow, onupdate=utcnow)
    location = db.Column(db.String(255), nullable=False)
    is_available = db.Column(db.Boolean(), default=True)
    category = db.Column(db.String(40), nullable=True)
    duration_hours = db.Column(db.Numeric(4, 1), nullable=True)
    destination_slug = db.Column(db.String(64), nullable=True)
    guide_id = db.Column(db.Integer, db.ForeignKey(add_prefix_for_prod("guides.id")), nullable=True)

    bookings = db.relationship("Booking", backref="tour", lazy=True)

    def to_dict(self):
        hours = float(self.duration_hours) if self.duration_hours is not None else None
        if hours is None and self.start_date and self.end_date:
            hours = round((self.end_date - self.start_date).total_seconds() / 3600, 1)
        return {
            "id": self.id,
            "tour_name": self.tour_name,
            "description": self.description,
            "price": float(self.price),
            "location": self.location,
            "is_available": self.is_available,
            "category": self.category,
            "duration_hours": hours,
            "destination_slug": self.destination_slug,
            "guide_id": self.guide_id,
            "start_time": self.start_date.strftime("%H:%M") if self.start_date else None,
        }
