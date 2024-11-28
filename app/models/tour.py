from .db import db, environment, SCHEMA

class Tour(db.Model):
    __tablename__ = 'tours'

    if environment == "production":
        __table_args__ = {'schema': SCHEMA}

    id = db.Column(db.Integer, primary_key=True)
    tour_name = db.Column(db.String(255), nullable=False)
    description = db.Column(db.Text, nullable=False)
    price = db.Column(db.Numeric(10, 2), nullable=False)
    start_date = db.Column(db.DateTime, nullable=False)
    end_date = db.Column(db.DateTime, nullable=False)
    created_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    created_at = db.Column(db.DateTime, default=db.func.now())
    updated_at = db.Column(db.DateTime, default=db.func.now(), onupdate=db.func.now())
    location = db.Column(db.String(255), nullable=False)
    is_available = db.Column(db.Boolean(), default=True)

    # Relationships
    bookings = db.relationship('Booking', backref='tour', lazy=True)

    def to_dict(self):
        return {
            'id': self.id,
            'tour_name': self.tour_name,
            'description': self.description,
            'price': str(self.price),
            'start_date': self.start_date,
            'end_date': self.end_date,
            'location': self.location,
            'is_available': self.is_available
        }