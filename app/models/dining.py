from . import db, add_prefix_for_prod

class Dining(db.Model):
    __tablename__ = add_prefix_for_prod('dining')

    id = db.Column(db.Integer, primary_key=True)
    restaurant_name = db.Column(db.String(128), nullable=False)
    cuisine_type = db.Column(db.String(64), nullable=False)
    average_cost = db.Column(db.Float, nullable=False)

    def to_dict(self):
        return {
            'id': self.id,
            'restaurant_name': self.restaurant_name,
            'cuisine_type': self.cuisine_type,
            'average_cost': self.average_cost
        }
