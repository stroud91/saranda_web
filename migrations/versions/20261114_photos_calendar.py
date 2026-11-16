"""Photos for listings, and calendars: manual date blocks and feeds imported
from other booking sites.

Revision ID: a91c5e0d7b24
Revises: f7b2d90c4a13
Create Date: 2026-11-14
"""
import sqlalchemy as sa
from alembic import op

from app.models.db import SCHEMA, USE_SCHEMA  # schema only on production PostgreSQL

SCH = SCHEMA if USE_SCHEMA else None

revision = "a91c5e0d7b24"
down_revision = "f7b2d90c4a13"
branch_labels = None
depends_on = None


def _fk(target):
    return f"{SCHEMA}.{target}" if SCH else target


def upgrade():
    op.create_table(
        "uploads",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("token", sa.String(32), nullable=False),
        sa.Column("business_id", sa.Integer(), sa.ForeignKey(_fk("businesses.id")), nullable=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey(_fk("users.id"), ondelete="SET NULL"), nullable=True),
        sa.Column("width", sa.Integer()),
        sa.Column("height", sa.Integer()),
        sa.Column("size", sa.Integer()),
        sa.Column("created_at", sa.DateTime()),
        schema=SCH,
    )
    op.create_index("ix_uploads_token", "uploads", ["token"], unique=True, schema=SCH)
    op.create_index("ix_uploads_business_id", "uploads", ["business_id"], schema=SCH)

    for table in ("tours", "car_rentals"):
        with op.batch_alter_table(table, schema=SCH) as batch:
            batch.add_column(sa.Column("image_urls", sa.JSON(), nullable=True))
    with op.batch_alter_table("hotels", schema=SCH) as batch:
        batch.add_column(sa.Column("calendar_token", sa.String(48), nullable=True))
    op.create_index("ix_hotels_calendar_token", "hotels", ["calendar_token"], unique=True, schema=SCH)

    op.create_table(
        "calendar_feeds",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("hotel_id", sa.Integer(), sa.ForeignKey(_fk("hotels.id")), nullable=False),
        sa.Column("name", sa.String(60), nullable=False),
        sa.Column("url", sa.String(600), nullable=False),
        sa.Column("last_synced_at", sa.DateTime(), nullable=True),
        sa.Column("last_ok_at", sa.DateTime(), nullable=True),
        sa.Column("last_error", sa.String(200), nullable=True),
        sa.Column("events", sa.Integer()),
        sa.Column("created_at", sa.DateTime()),
        schema=SCH,
    )
    op.create_index("ix_calendar_feeds_hotel_id", "calendar_feeds", ["hotel_id"], schema=SCH)
    op.create_table(
        "date_blocks",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("hotel_id", sa.Integer(), sa.ForeignKey(_fk("hotels.id")), nullable=False),
        sa.Column("feed_id", sa.Integer(), sa.ForeignKey(_fk("calendar_feeds.id")), nullable=True),
        sa.Column("start_date", sa.Date(), nullable=False),
        sa.Column("end_date", sa.Date(), nullable=False),
        sa.Column("note", sa.String(200), nullable=True),
        sa.Column("created_at", sa.DateTime()),
        schema=SCH,
    )
    op.create_index("ix_date_blocks_hotel_id", "date_blocks", ["hotel_id"], schema=SCH)
    op.create_index("ix_date_blocks_feed_id", "date_blocks", ["feed_id"], schema=SCH)


def downgrade():
    op.drop_index("ix_date_blocks_feed_id", "date_blocks", schema=SCH)
    op.drop_index("ix_date_blocks_hotel_id", "date_blocks", schema=SCH)
    op.drop_table("date_blocks", schema=SCH)
    op.drop_index("ix_calendar_feeds_hotel_id", "calendar_feeds", schema=SCH)
    op.drop_table("calendar_feeds", schema=SCH)
    op.drop_index("ix_hotels_calendar_token", "hotels", schema=SCH)
    with op.batch_alter_table("hotels", schema=SCH) as batch:
        batch.drop_column("calendar_token")
    for table in ("car_rentals", "tours"):
        with op.batch_alter_table(table, schema=SCH) as batch:
            batch.drop_column("image_urls")
    op.drop_index("ix_uploads_business_id", "uploads", schema=SCH)
    op.drop_index("ix_uploads_token", "uploads", schema=SCH)
    op.drop_table("uploads", schema=SCH)
