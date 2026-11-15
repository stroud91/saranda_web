from .db import db, table_args


class StatCounter(db.Model):
    """One number per day, kind and key: page views of an address, visitors from a
    referrer, visitors per language… Nothing here refers to a person."""

    __tablename__ = "stat_counters"
    __table_args__ = table_args(db.UniqueConstraint("day", "kind", "key", name="uq_stat_counters_day_kind_key"))

    id = db.Column(db.Integer, primary_key=True)
    day = db.Column(db.Date, nullable=False, index=True)
    kind = db.Column(db.String(10), nullable=False)  # views | visitors | page | entry | ref | lang | device
    key = db.Column(db.String(120), nullable=False, default="")
    count = db.Column(db.Integer, nullable=False, default=0)


class StatVisitor(db.Model):
    """Today's visitors as one-day codes, only so the same browser is counted once.
    A code is a keyed hash that changes every day; rows are deleted the next day."""

    __tablename__ = "stat_visitors"
    __table_args__ = table_args(db.UniqueConstraint("day", "code", name="uq_stat_visitors_day_code"))

    id = db.Column(db.Integer, primary_key=True)
    day = db.Column(db.Date, nullable=False, index=True)
    code = db.Column(db.String(32), nullable=False)
