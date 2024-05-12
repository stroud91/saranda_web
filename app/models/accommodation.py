from . import db, add_prefix_for_prod

class Accommodation(db.Model):
    __tablename__ = add_prefix_for_prod('accommodation')

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(128), nullable=False)
    description = db.Column(db.Text, nullable=True)
    price_per_night = db.Column(db.Float, nullable=False)
    max_guests = db.Column(db.Integer, nullable=False)
    bookings = db.relationship('Booking', backref='accommodation', lazy=True)

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'description': self.description,
            'price_per_night': self.price_per_night,
            'max_guests': self.max_guests
        }
