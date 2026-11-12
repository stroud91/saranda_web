from .business import Reviewable
from .db import db, table_args, utcnow


class CarRental(Reviewable, db.Model):
    __tablename__ = "car_rentals"
    __table_args__ = table_args()

    id = db.Column(db.Integer, primary_key=True)
    car_model = db.Column(db.String(255), nullable=False)
    car_type = db.Column(db.String(50), nullable=False)
    price_per_day = db.Column(db.Numeric(10, 2), nullable=False)
    availability_status = db.Column(db.String(50), default="available")
    created_at = db.Column(db.DateTime, default=utcnow)
    updated_at = db.Column(db.DateTime, default=utcnow, onupdate=utcnow)
    rental_company = db.Column(db.String(255), nullable=False)
    location = db.Column(db.String(255), nullable=False)
    seats = db.Column(db.Integer, nullable=True)
    transmission = db.Column(db.String(20), nullable=True)
    description = db.Column(db.Text, nullable=True)

    bookings = db.relationship("Booking", backref="car_rental", lazy=True)

    def to_dict(self):
        return {
            "id": self.id,
            "car_model": self.car_model,
            "car_type": self.car_type,
            "price_per_day": float(self.price_per_day),
            "availability_status": self.availability_status,
            # A partner's rentals always carry the business's current name.
            "rental_company": self.business.name if self.business else self.rental_company,
            "location": self.location,
            "seats": self.seats,
            "transmission": self.transmission,
            "description": self.description,
            "business": self.business_brief(),
        }
