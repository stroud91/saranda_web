from . import db, add_prefix_for_prod

class User(db.Model, UserMixin):
    __tablename__ = add_prefix_for_prod('users')

    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(40), nullable=False, unique=True)
    email = db.Column(db.String(255), nullable=False, unique=True)
    clerk_id = db.Column(db.String(255), nullable=False, unique=True)

    def to_dict(self):
        return {
            'id': self.id,
            'username': self.username,
            'email': self.email,
            'clerk_id': self.clerk_id
        }
