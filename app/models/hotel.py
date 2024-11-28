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
    created_at = db.Column(db.DateTime, default=db.func.now())
    updated_at = db.Column(db.DateTime, default=db.func.now(), onupdate=db.func.now())
    city = db.Column(db.String(255), nullable=False)
    contact_email = db.Column(db.String(255))

    # Relationships
    bookings = db.relationship('Booking', backref='hotel', lazy=True)

    def to_dict(self):
        return {
            'id': self.id,
            'hotel_name': self.hotel_name,
            'address': self.address,
            'price_per_night': str(self.price_per_night),
            'total_rooms': self.total_rooms,
            'available_rooms': self.available_rooms,
            'city': self.city,
            'contact_email': self.contact_email
        }