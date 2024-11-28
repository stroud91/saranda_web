from .db import db, environment, SCHEMA

class CarRental(db.Model):
    __tablename__ = 'car_rentals'

    if environment == "production":
        __table_args__ = {'schema': SCHEMA}

    id = db.Column(db.Integer, primary_key=True)
    car_model = db.Column(db.String(255), nullable=False)
    car_type = db.Column(db.String(50), nullable=False)
    price_per_day = db.Column(db.Numeric(10, 2), nullable=False)
    availability_status = db.Column(db.String(50), default='available')
    created_at = db.Column(db.DateTime, default=db.func.now())
    updated_at = db.Column(db.DateTime, default=db.func.now(), onupdate=db.func.now())
    rental_company = db.Column(db.String(255), nullable=False)
    location = db.Column(db.String(255), nullable=False)

    # Relationships
    bookings = db.relationship('Booking', backref='car_rental', lazy=True)

    def to_dict(self):
        return {
            'id': self.id,
            'car_model': self.car_model,
            'car_type': self.car_type,
            'price_per_day': str(self.price_per_day),
            'availability_status': self.availability_status,
            'rental_company': self.rental_company,
            'location': self.location
        }