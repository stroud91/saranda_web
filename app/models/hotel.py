from .db import db, table_args, utcnow


class Hotel(db.Model):
    """A bookable stay. For Meg'Rooms each row is one apartment."""

    __tablename__ = "hotels"
    __table_args__ = table_args()

    id = db.Column(db.Integer, primary_key=True)
    hotel_name = db.Column(db.String(255), nullable=False)
    address = db.Column(db.String(255), nullable=False)
    price_per_night = db.Column(db.Numeric(10, 2), nullable=False)
    total_rooms = db.Column(db.Integer, nullable=False)
    available_rooms = db.Column(db.Integer, nullable=False)
    city = db.Column(db.String(255), nullable=False)
    contact_email = db.Column(db.String(255))
    created_at = db.Column(db.DateTime, default=utcnow)
    updated_at = db.Column(db.DateTime, default=utcnow, onupdate=utcnow)

    apartment_number = db.Column(db.Integer, nullable=True)
    apartment_name = db.Column(db.String(255), nullable=True)
    bedrooms = db.Column(db.Integer, default=1)
    beds = db.Column(db.Integer, default=1)
    bathrooms = db.Column(db.Numeric(3, 1), default=1.0)
    max_guests = db.Column(db.Integer, default=2)
    tag = db.Column(db.String(100), nullable=True)
    rating_source = db.Column(db.String(50), default="Airbnb")
    airbnb_rating = db.Column(db.Numeric(4, 2), nullable=True)
    image_urls = db.Column(db.JSON, nullable=True)
    description = db.Column(db.Text, nullable=True)
    amenities = db.Column(db.JSON, nullable=True)
    min_nights = db.Column(db.Integer, default=1)
    cleaning_fee = db.Column(db.Numeric(10, 2), default=0)
    is_active = db.Column(db.Boolean(), default=True)

    bookings = db.relationship("Booking", backref="hotel", lazy=True)

    def to_dict(self):
        return {
            "id": self.id,
            "hotel_name": self.hotel_name,
            "address": self.address,
            "price_per_night": float(self.price_per_night),
            "city": self.city,
            "apartment_number": self.apartment_number,
            "apartment_name": self.apartment_name,
            "bedrooms": self.bedrooms,
            "beds": self.beds,
            "bathrooms": float(self.bathrooms) if self.bathrooms is not None else 1.0,
            "max_guests": self.max_guests,
            "tag": self.tag,
            "rating_source": self.rating_source,
            "airbnb_rating": float(self.airbnb_rating) if self.airbnb_rating is not None else None,
            "image_urls": self.image_urls or [],
            "description": self.description,
            "amenities": self.amenities or [],
            "min_nights": self.min_nights or 1,
            "cleaning_fee": float(self.cleaning_fee or 0),
        }
