from .db import db, environment, SCHEMA


class Booking(db.Model):
    __tablename__ = 'bookings'

    if environment == "production":
        __table_args__ = {'schema': SCHEMA}

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    tour_id = db.Column(db.Integer, db.ForeignKey('tours.id'), nullable=True)
    hotel_id = db.Column(db.Integer, db.ForeignKey('hotels.id'), nullable=True)
    car_id = db.Column(db.Integer, db.ForeignKey('car_rentals.id'), nullable=True)
    start_date = db.Column(db.DateTime, nullable=False)
    end_date = db.Column(db.DateTime, nullable=False)
    total_cost = db.Column(db.Numeric(10, 2), nullable=False)
    created_at = db.Column(db.DateTime, default=db.func.now())
    status = db.Column(db.String(50), default='pending')

    # Guest checkout fields (no account required)
    guest_name = db.Column(db.String(255), nullable=True)
    guest_email = db.Column(db.String(255), nullable=True)
    guest_phone = db.Column(db.String(50), nullable=True)
    guest_count = db.Column(db.Integer, nullable=True)
    notes = db.Column(db.Text, nullable=True)
    stripe_payment_intent_id = db.Column(db.String(255), nullable=True)

    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'tour_id': self.tour_id,
            'hotel_id': self.hotel_id,
            'car_id': self.car_id,
            'start_date': self.start_date.isoformat() if self.start_date else None,
            'end_date': self.end_date.isoformat() if self.end_date else None,
            'total_cost': float(self.total_cost),
            'status': self.status,
            'guest_name': self.guest_name,
            'guest_email': self.guest_email,
            'guest_phone': self.guest_phone,
            'guest_count': self.guest_count,
            'notes': self.notes,
            'stripe_payment_intent_id': self.stripe_payment_intent_id,
        }
