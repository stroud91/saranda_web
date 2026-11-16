from .db import add_prefix_for_prod, db, table_args, utcnow


class Upload(db.Model):
    """A photo stored on the server. The file name is the random ``token``;
    ``business_id`` says who may attach it to a listing (null = the site's own)."""

    __tablename__ = "uploads"
    __table_args__ = table_args()

    id = db.Column(db.Integer, primary_key=True)
    token = db.Column(db.String(32), unique=True, nullable=False, index=True)
    business_id = db.Column(db.Integer, db.ForeignKey(add_prefix_for_prod("businesses.id")), nullable=True, index=True)
    user_id = db.Column(db.Integer, db.ForeignKey(add_prefix_for_prod("users.id"), ondelete="SET NULL"), nullable=True)
    width = db.Column(db.Integer)
    height = db.Column(db.Integer)
    size = db.Column(db.Integer)  # bytes on disk, large + small versions
    created_at = db.Column(db.DateTime, default=utcnow)

    @property
    def url(self):
        return f"/media/u/{self.token}.jpg"

    def to_dict(self):
        return {"url": self.url, "thumb": f"/media/u/{self.token}_s.jpg", "width": self.width, "height": self.height}
