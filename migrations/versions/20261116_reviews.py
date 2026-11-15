"""Guest reviews of stays, and the invitation that asks for one.

Revision ID: c5a8e41d9f37
Revises: b3d7f2a91c10
Create Date: 2026-11-16
"""
import sqlalchemy as sa
from alembic import op

from app.models.db import SCHEMA, USE_SCHEMA  # schema only on production PostgreSQL

SCH = SCHEMA if USE_SCHEMA else None

revision = "c5a8e41d9f37"
down_revision = "b3d7f2a91c10"
branch_labels = None
depends_on = None


def _fk(target):
    return f"{SCHEMA}.{target}" if SCH else target


def upgrade():
    op.create_table(
        "reviews",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("hotel_id", sa.Integer(), sa.ForeignKey(_fk("hotels.id")), nullable=False),
        sa.Column("booking_id", sa.Integer(), sa.ForeignKey(_fk("bookings.id")), nullable=False),
        sa.Column("rating", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(120)),
        sa.Column("text", sa.Text(), nullable=False),
        sa.Column("author_name", sa.String(60)),
        sa.Column("stay_month", sa.String(7)),
        sa.Column("lang", sa.String(2)),
        sa.Column("status", sa.String(12), nullable=False, server_default="published"),
        sa.Column("hidden_reason", sa.String(300)),
        sa.Column("reply", sa.Text()),
        sa.Column("replied_at", sa.DateTime()),
        sa.Column("created_at", sa.DateTime()),
        sa.UniqueConstraint("booking_id", name="uq_reviews_booking_id"),
        schema=SCH,
    )
    op.create_index("ix_reviews_hotel_id", "reviews", ["hotel_id"], schema=SCH)
    with op.batch_alter_table("bookings", schema=SCH) as batch:
        batch.add_column(sa.Column("review_key_hash", sa.String(64), nullable=True))
        batch.add_column(sa.Column("review_invited_at", sa.DateTime(), nullable=True))


def downgrade():
    with op.batch_alter_table("bookings", schema=SCH) as batch:
        batch.drop_column("review_invited_at")
        batch.drop_column("review_key_hash")
    op.drop_index("ix_reviews_hotel_id", table_name="reviews", schema=SCH)
    op.drop_table("reviews", schema=SCH)
