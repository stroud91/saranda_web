from werkzeug.security import check_password_hash, generate_password_hash

from .db import db, table_args, utcnow


class User(db.Model):
    __tablename__ = "users"
    __table_args__ = table_args()

    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(255), nullable=False, unique=True)
    email = db.Column(db.String(255), nullable=False, unique=True)
    password_hash = db.Column(db.String(255), nullable=False)
    phone_number = db.Column(db.String(20))
    role = db.Column(db.String(50), default="guest")
    is_verified = db.Column(db.Boolean(), default=False)
    clerk_user_id = db.Column(db.String(64), unique=True, index=True, nullable=True)
    created_at = db.Column(db.DateTime, default=utcnow)
    updated_at = db.Column(db.DateTime, default=utcnow, onupdate=utcnow)

    bookings = db.relationship("Booking", backref="user", lazy=True)
    tours_created = db.relationship("Tour", backref="creator", lazy=True)

    @property
    def password(self):
        raise AttributeError("password is write-only")

    @password.setter
    def password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)

    def to_dict(self):
        return {"id": self.id, "username": self.username, "role": self.role}
