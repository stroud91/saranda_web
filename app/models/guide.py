from .db import add_prefix_for_prod, db, mask_email, new_reference, table_args, utcnow

DURATIONS = {"half": "Half day (≈4h)", "full": "Full day (≈8h)", "multi": "Multi-day"}
ACTIVE_REQUEST_STATUSES = ("requested", "accepted")


class Guide(db.Model):
    __tablename__ = "guides"
    __table_args__ = table_args()

    id = db.Column(db.Integer, primary_key=True)
    slug = db.Column(db.String(80), unique=True, nullable=False, index=True)
    name = db.Column(db.String(120), nullable=False)
    headline = db.Column(db.String(200), nullable=False)
    bio = db.Column(db.Text, nullable=False)
    base_city = db.Column(db.String(80), nullable=False)
    languages = db.Column(db.JSON, nullable=False, default=list)
    specialties = db.Column(db.JSON, nullable=False, default=list)
    regions = db.Column(db.JSON, nullable=False, default=list)
    signature_stops = db.Column(db.JSON, nullable=False, default=list)
    years_experience = db.Column(db.Integer, default=1)
    price_half_day = db.Column(db.Numeric(10, 2), nullable=False)
    price_full_day = db.Column(db.Numeric(10, 2), nullable=False)
    max_group = db.Column(db.Integer, default=8)
    has_vehicle = db.Column(db.Boolean(), default=False)
    licensed = db.Column(db.Boolean(), default=False)
    rating = db.Column(db.Numeric(3, 2), nullable=True)
    review_count = db.Column(db.Integer, default=0)
    palette = db.Column(db.String(20), default="sea")
    contact_email = db.Column(db.String(255), nullable=True)
    whatsapp = db.Column(db.String(30), nullable=True)
    # Sample profiles ship with the seed data and must be replaced before launch.
    is_sample = db.Column(db.Boolean(), default=True)
    is_active = db.Column(db.Boolean(), default=True)
    created_at = db.Column(db.DateTime, default=utcnow)
    updated_at = db.Column(db.DateTime, default=utcnow, onupdate=utcnow)

    requests = db.relationship("GuideBooking", backref="guide", lazy=True)

    @classmethod
    def listed(cls):
        """Guides guests may see and request.

        Sample profiles from the seed data stay hidden unless SHOW_SAMPLE_GUIDES
        is switched on, so nobody can request a guide who doesn't exist.
        """
        from flask import current_app

        query = cls.query.filter_by(is_active=True)
        if not current_app.config.get("SHOW_SAMPLE_GUIDES"):
            query = query.filter(cls.is_sample.isnot(True))
        return query

    def quote(self, duration, days=1):
        if duration == "half":
            return float(self.price_half_day)
        if duration == "full":
            return float(self.price_full_day)
        return float(self.price_full_day) * max(1, days)

    def to_dict(self):
        return {
            "id": self.id,
            "slug": self.slug,
            "name": self.name,
            "headline": self.headline,
            "bio": self.bio,
            "base_city": self.base_city,
            "languages": self.languages or [],
            "specialties": self.specialties or [],
            "regions": self.regions or [],
            "signature_stops": self.signature_stops or [],
            "years_experience": self.years_experience,
            "price_half_day": float(self.price_half_day),
            "price_full_day": float(self.price_full_day),
            "max_group": self.max_group,
            "has_vehicle": self.has_vehicle,
            "licensed": self.licensed,
            "rating": float(self.rating) if self.rating is not None else None,
            "review_count": self.review_count or 0,
            "palette": self.palette,
            "is_sample": self.is_sample,
        }


class GuideBooking(db.Model):
    """A request to book a guide. The guide confirms before anything is paid."""

    __tablename__ = "guide_bookings"
    __table_args__ = table_args()

    id = db.Column(db.Integer, primary_key=True)
    reference = db.Column(db.String(20), unique=True, index=True, default=lambda: new_reference("G"))
    guide_id = db.Column(db.Integer, db.ForeignKey(add_prefix_for_prod("guides.id")), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey(add_prefix_for_prod("users.id")), nullable=True, index=True)
    tour_date = db.Column(db.Date, nullable=False, index=True)
    duration = db.Column(db.String(10), nullable=False)
    days = db.Column(db.Integer, default=1)
    group_size = db.Column(db.Integer, nullable=False)
    itinerary_slug = db.Column(db.String(80), nullable=True)
    stops = db.Column(db.JSON, nullable=True)
    pickup = db.Column(db.String(200), nullable=True)
    language = db.Column(db.String(40), nullable=True)
    name = db.Column(db.String(120), nullable=False)
    email = db.Column(db.String(255), nullable=False)
    phone = db.Column(db.String(40), nullable=True)
    message = db.Column(db.Text, nullable=True)
    quoted_price = db.Column(db.Numeric(10, 2), nullable=False)
    status = db.Column(db.String(20), default="requested")  # requested | accepted | declined | cancelled
    created_at = db.Column(db.DateTime, default=utcnow)
    updated_at = db.Column(db.DateTime, default=utcnow, onupdate=utcnow)

    def to_public_dict(self):
        return {
            "reference": self.reference,
            "guide": {"slug": self.guide.slug, "name": self.guide.name} if self.guide else None,
            "tour_date": self.tour_date.isoformat(),
            "duration": self.duration,
            "duration_label": DURATIONS.get(self.duration),
            "days": self.days,
            "group_size": self.group_size,
            "itinerary_slug": self.itinerary_slug,
            "stops": self.stops or [],
            "language": self.language,
            "quoted_price": float(self.quoted_price),
            "status": self.status,
            "first_name": (self.name or "").split(" ")[0],
            "email_masked": mask_email(self.email),
            "created_at": self.created_at.isoformat() + "Z" if self.created_at else None,
        }

    def to_admin_dict(self):
        out = self.to_public_dict()
        out.update({"id": self.id, "name": self.name, "email": self.email, "phone": self.phone,
                    "pickup": self.pickup, "message": self.message})
        return out
