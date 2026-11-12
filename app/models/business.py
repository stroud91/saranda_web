"""Local businesses that list their own stays, rentals and activities.

Nothing a business submits is shown to guests until the site's host approves
it. Edits to something already approved are kept in ``pending_changes`` and
only replace the live version once they are approved too.
"""
from sqlalchemy.orm import declared_attr

from .db import add_prefix_for_prod, db, mask_email, new_reference, table_args, utcnow

# pending (awaiting first review) | approved | rejected | suspended (host took it down) | closed (owner left)
BUSINESS_STATUSES = ("pending", "approved", "rejected", "suspended", "closed")
PALETTES = ("sea", "sunset", "olive", "lagoon", "aegean", "spring", "terracotta")


class Business(db.Model):
    __tablename__ = "businesses"
    __table_args__ = table_args()

    id = db.Column(db.Integer, primary_key=True)
    # One business per account. Null once the owner has deleted their account.
    owner_id = db.Column(db.Integer, db.ForeignKey(add_prefix_for_prod("users.id")), nullable=True, unique=True, index=True)
    slug = db.Column(db.String(80), unique=True, nullable=False, index=True)
    name = db.Column(db.String(120), nullable=False)
    tagline = db.Column(db.String(160), nullable=True)
    description = db.Column(db.Text, nullable=True)
    city = db.Column(db.String(80), nullable=True)
    address = db.Column(db.String(255), nullable=True)
    # Public contact details, shown on the business page once approved.
    email = db.Column(db.String(255), nullable=True)
    phone = db.Column(db.String(40), nullable=True)
    whatsapp = db.Column(db.String(40), nullable=True)
    website = db.Column(db.String(255), nullable=True)
    palette = db.Column(db.String(20), default="sea")
    status = db.Column(db.String(20), default="pending", nullable=False)
    review_note = db.Column(db.Text, nullable=True)
    pending_changes = db.Column(db.JSON(none_as_null=True), nullable=True)
    created_at = db.Column(db.DateTime, default=utcnow)
    updated_at = db.Column(db.DateTime, default=utcnow, onupdate=utcnow)
    reviewed_at = db.Column(db.DateTime, nullable=True)

    owner = db.relationship("User", backref=db.backref("business", uselist=False), lazy=True)

    PROFILE_FIELDS = ("name", "tagline", "description", "city", "address", "email", "phone", "whatsapp", "website", "palette")

    @property
    def is_public(self):
        return self.status == "approved"

    def brief(self):
        return {"slug": self.slug, "name": self.name}

    def to_public_dict(self):
        out = {k: getattr(self, k) for k in self.PROFILE_FIELDS}
        out.update({"slug": self.slug, "since": self.created_at.year if self.created_at else None})
        return out

    def to_owner_dict(self):
        """What the owner edits: the live profile with their unreviewed changes on top."""
        out = self.to_public_dict()
        out.update(self.pending_changes or {})
        out.update({"id": self.id, "status": self.status, "review_note": self.review_note,
                    "has_pending_changes": bool(self.pending_changes)})
        return out


class Reviewable:
    """Ownership and review columns shared by stays, experiences and rentals.

    ``business_id`` is null for the site's own listings. ``review_status`` is
    pending | approved | rejected | removed; rows from before the partner
    portal are treated as approved.
    """

    review_status = db.Column(db.String(20), default="approved", server_default="approved", nullable=True)
    review_note = db.Column(db.Text, nullable=True)
    pending_changes = db.Column(db.JSON(none_as_null=True), nullable=True)

    @declared_attr
    def business_id(cls):
        return db.Column(db.Integer, db.ForeignKey(add_prefix_for_prod("businesses.id")), nullable=True, index=True)

    @declared_attr
    def business(cls):
        # "selectin" loads the business in a second query, so row locks (FOR UPDATE)
        # on a listing never have to cover an outer join.
        return db.relationship("Business", lazy="selectin")

    @property
    def is_public(self):
        return (self.review_status or "approved") == "approved" and (self.business is None or self.business.is_public)

    def business_brief(self):
        return self.business.brief() if self.business else None


class Enquiry(db.Model):
    """A guest's question to a business, about one of its listings or in general.

    The business answers directly by e-mail or phone; nothing is paid here.
    """

    __tablename__ = "enquiries"
    __table_args__ = table_args()

    id = db.Column(db.Integer, primary_key=True)
    reference = db.Column(db.String(20), unique=True, index=True, default=lambda: new_reference("Q"))
    business_id = db.Column(db.Integer, db.ForeignKey(add_prefix_for_prod("businesses.id")), nullable=False, index=True)
    tour_id = db.Column(db.Integer, db.ForeignKey(add_prefix_for_prod("tours.id")), nullable=True)
    car_id = db.Column(db.Integer, db.ForeignKey(add_prefix_for_prod("car_rentals.id")), nullable=True)
    user_id = db.Column(db.Integer, db.ForeignKey(add_prefix_for_prod("users.id")), nullable=True, index=True)
    subject = db.Column(db.String(255), nullable=False)  # the listing's name when asked, or "General question"
    name = db.Column(db.String(120), nullable=False)
    email = db.Column(db.String(255), nullable=False)
    phone = db.Column(db.String(40), nullable=True)
    start_date = db.Column(db.Date, nullable=True)
    end_date = db.Column(db.Date, nullable=True)
    people = db.Column(db.Integer, nullable=True)
    message = db.Column(db.Text, nullable=False)
    status = db.Column(db.String(20), default="new")  # new | answered | closed
    created_at = db.Column(db.DateTime, default=utcnow)

    business = db.relationship("Business", lazy=True)

    @property
    def kind(self):
        return "experience" if self.tour_id else "rental" if self.car_id else "general"

    def _base(self):
        return {
            "reference": self.reference,
            "kind": self.kind,
            "subject": self.subject,
            "start_date": self.start_date.isoformat() if self.start_date else None,
            "end_date": self.end_date.isoformat() if self.end_date else None,
            "people": self.people,
            "status": self.status,
            "created_at": self.created_at.isoformat() + "Z" if self.created_at else None,
        }

    def to_public_dict(self):
        """For the guest who sent it (contact details masked)."""
        out = self._base()
        out.update({"business": self.business.brief() if self.business else None, "email_masked": mask_email(self.email)})
        return out

    def to_owner_dict(self):
        """For the business it was sent to, and the sender's own data export."""
        out = self._base()
        out.update({"name": self.name, "email": self.email, "phone": self.phone, "message": self.message})
        return out
