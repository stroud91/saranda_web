from .db import db, environment, SCHEMA

class Booking(db.Model):
    __tablename__ = 'bookings'

    if environment == "production":
        __table_args__ = {'schema': SCHEMA}

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    tour_id = db.Column(db.Integer, db.ForeignKey('tours.id'))
    hotel_id = db.Column(db.Integer, db.ForeignKey('hotels.id'))
    car_id = db.Column(db.Integer, db.ForeignKey('car_rentals.id'))
    start_date = db.Column(db.DateTime, nullable=False)
    end_date = db.Column(db.DateTime, nullable=False)
    total_cost = db.Column(db.Numeric(10, 2), nullable=False)
    created_at = db.Column(db.DateTime, default=db.func.now())
    status = db.Column(db.String(50), default='pending')

    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'tour_id': self.tour_id,
            'hotel_id': self.hotel_id,
            'car_id': self.car_id,
            'start_date': self.start_date,
            'end_date': self.end_date,
            'total_cost': str(self.total_cost),
            'status': self.status
        }
