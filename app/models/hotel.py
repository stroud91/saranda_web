from .db import db, environment, SCHEMA


class Hotel(db.Model):
    __tablename__ = 'hotels'

    if environment == "production":
        __table_args__ = {'schema': SCHEMA}

    id = db.Column(db.Integer, primary_key=True)
    hotel_name = db.Column(db.String(255), nullable=False)
    address = db.Column(db.String(255), nullable=False)
    price_per_night = db.Column(db.Numeric(10, 2), nullable=False)
    total_rooms = db.Column(db.Integer, nullable=False)
    available_rooms = db.Column(db.Integer, nullable=False)
    city = db.Column(db.String(255), nullable=False)
    contact_email = db.Column(db.String(255))
    created_at = db.Column(db.DateTime, default=db.func.now())
    updated_at = db.Column(db.DateTime, default=db.func.now(), onupdate=db.func.now())

    # Apartment-specific fields
    apartment_number = db.Column(db.Integer, nullable=True)
    apartment_name = db.Column(db.String(255), nullable=True)
    bedrooms = db.Column(db.Integer, default=1)
    beds = db.Column(db.Integer, default=1)
    bathrooms = db.Column(db.Numeric(3, 1), default=1.0)
    max_guests = db.Column(db.Integer, default=2)
    tag = db.Column(db.String(100), nullable=True)
    rating_source = db.Column(db.String(50), default='Airbnb')
    airbnb_rating = db.Column(db.Numeric(4, 2), nullable=True)
    image_urls = db.Column(db.JSON, nullable=True)
    description = db.Column(db.Text, nullable=True)
    amenities = db.Column(db.JSON, nullable=True)

    # Relationships
    bookings = db.relationship('Booking', backref='hotel', lazy=True)

    def to_dict(self):
        return {
            'id': self.id,
            'hotel_name': self.hotel_name,
            'address': self.address,
            'price_per_night': float(self.price_per_night),
            'total_rooms': self.total_rooms,
            'available_rooms': self.available_rooms,
            'city': self.city,
            'contact_email': self.contact_email,
            'apartment_number': self.apartment_number,
            'apartment_name': self.apartment_name,
            'bedrooms': self.bedrooms,
            'beds': self.beds,
            'bathrooms': float(self.bathrooms) if self.bathrooms else 1.0,
            'max_guests': self.max_guests,
            'tag': self.tag,
            'rating_source': self.rating_source,
            'airbnb_rating': float(self.airbnb_rating) if self.airbnb_rating else None,
            'image_urls': self.image_urls or [],
            'description': self.description,
            'amenities': self.amenities or [],
        }
