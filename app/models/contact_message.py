from .db import db, table_args, utcnow


class ContactMessage(db.Model):
    __tablename__ = "contact_messages"
    __table_args__ = table_args()

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(120), nullable=False)
    email = db.Column(db.String(255), nullable=False)
    topic = db.Column(db.String(40), default="general")
    message = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.DateTime, default=utcnow)
    handled = db.Column(db.Boolean(), default=False)

    def to_admin_dict(self):
        return {"id": self.id, "name": self.name, "email": self.email, "topic": self.topic,
                "message": self.message, "handled": self.handled,
                "created_at": self.created_at.isoformat() + "Z" if self.created_at else None}
