"""Albania companion platform: guides, guide requests, saved trips, contact
messages; booking references/holds; tour & stay extras.

Revision ID: c3f1a9d27e10
Revises: a4c8f20d9b3e
Create Date: 2026-09-29
"""
import os

import sqlalchemy as sa
from alembic import op

from app.models.db import SCHEMA, USE_SCHEMA  # schema only on production PostgreSQL

SCH = SCHEMA if USE_SCHEMA else None

revision = "c3f1a9d27e10"
down_revision = "a4c8f20d9b3e"
branch_labels = None
depends_on = None


def _fk(target):
    return f"{SCHEMA}.{target}" if SCH else target


def _cols(table):
    return {c["name"] for c in sa.inspect(op.get_bind()).get_columns(table, schema=SCH)}


def _add_missing(table, columns):
    existing = _cols(table)
    todo = [c for c in columns if c.name not in existing]
    if todo:
        with op.batch_alter_table(table, schema=SCH) as batch:
            for col in todo:
                batch.add_column(col)


def upgrade():
    op.create_table(
        "guides",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("slug", sa.String(80), nullable=False),
        sa.Column("name", sa.String(120), nullable=False),
        sa.Column("headline", sa.String(200), nullable=False),
        sa.Column("bio", sa.Text(), nullable=False),
        sa.Column("base_city", sa.String(80), nullable=False),
        sa.Column("languages", sa.JSON(), nullable=False),
        sa.Column("specialties", sa.JSON(), nullable=False),
        sa.Column("regions", sa.JSON(), nullable=False),
        sa.Column("signature_stops", sa.JSON(), nullable=False),
        sa.Column("years_experience", sa.Integer()),
        sa.Column("price_half_day", sa.Numeric(10, 2), nullable=False),
        sa.Column("price_full_day", sa.Numeric(10, 2), nullable=False),
        sa.Column("max_group", sa.Integer()),
        sa.Column("has_vehicle", sa.Boolean()),
        sa.Column("licensed", sa.Boolean()),
        sa.Column("rating", sa.Numeric(3, 2), nullable=True),
        sa.Column("review_count", sa.Integer()),
        sa.Column("palette", sa.String(20)),
        sa.Column("contact_email", sa.String(255), nullable=True),
        sa.Column("whatsapp", sa.String(30), nullable=True),
        sa.Column("is_sample", sa.Boolean()),
        sa.Column("is_active", sa.Boolean()),
        sa.Column("created_at", sa.DateTime()),
        sa.Column("updated_at", sa.DateTime()),
        schema=SCH,
    )
    op.create_index("ix_guides_slug", "guides", ["slug"], unique=True, schema=SCH)

    op.create_table(
        "guide_bookings",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("reference", sa.String(20)),
        sa.Column("guide_id", sa.Integer(), sa.ForeignKey(_fk("guides.id")), nullable=False),
        sa.Column("tour_date", sa.Date(), nullable=False),
        sa.Column("duration", sa.String(10), nullable=False),
        sa.Column("days", sa.Integer()),
        sa.Column("group_size", sa.Integer(), nullable=False),
        sa.Column("itinerary_slug", sa.String(80), nullable=True),
        sa.Column("stops", sa.JSON(), nullable=True),
        sa.Column("pickup", sa.String(200), nullable=True),
        sa.Column("language", sa.String(40), nullable=True),
        sa.Column("name", sa.String(120), nullable=False),
        sa.Column("email", sa.String(255), nullable=False),
        sa.Column("phone", sa.String(40), nullable=True),
        sa.Column("message", sa.Text(), nullable=True),
        sa.Column("quoted_price", sa.Numeric(10, 2), nullable=False),
        sa.Column("status", sa.String(20)),
        sa.Column("created_at", sa.DateTime()),
        sa.Column("updated_at", sa.DateTime()),
        schema=SCH,
    )
    op.create_index("ix_guide_bookings_reference", "guide_bookings", ["reference"], unique=True, schema=SCH)
    op.create_index("ix_guide_bookings_tour_date", "guide_bookings", ["tour_date"], schema=SCH)

    op.create_table(
        "trip_plans",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("share_id", sa.String(32), nullable=False),
        sa.Column("edit_key_hash", sa.String(64), nullable=False),
        sa.Column("title", sa.String(120), nullable=False),
        sa.Column("data", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime()),
        sa.Column("updated_at", sa.DateTime()),
        schema=SCH,
    )
    op.create_index("ix_trip_plans_share_id", "trip_plans", ["share_id"], unique=True, schema=SCH)

    op.create_table(
        "contact_messages",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(120), nullable=False),
        sa.Column("email", sa.String(255), nullable=False),
        sa.Column("topic", sa.String(40)),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime()),
        sa.Column("handled", sa.Boolean()),
        schema=SCH,
    )

    _add_missing("bookings", [
        sa.Column("reference", sa.String(20), nullable=True),
        sa.Column("nights", sa.Integer(), nullable=True),
        sa.Column("currency", sa.String(3), nullable=True, server_default="EUR"),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
        sa.Column("payment_status", sa.String(30), nullable=True, server_default="unpaid"),
        sa.Column("hold_expires_at", sa.DateTime(), nullable=True),
    ])
    op.create_index("ix_bookings_reference", "bookings", ["reference"], unique=True, schema=SCH)
    op.create_index("ix_bookings_stripe_payment_intent_id", "bookings", ["stripe_payment_intent_id"], schema=SCH)

    _add_missing("hotels", [
        sa.Column("min_nights", sa.Integer(), nullable=True, server_default="1"),
        sa.Column("cleaning_fee", sa.Numeric(10, 2), nullable=True, server_default="0"),
        sa.Column("is_active", sa.Boolean(), nullable=True, server_default=sa.true()),
    ])
    _add_missing("tours", [
        sa.Column("category", sa.String(40), nullable=True),
        sa.Column("duration_hours", sa.Numeric(4, 1), nullable=True),
        sa.Column("destination_slug", sa.String(64), nullable=True),
        sa.Column("guide_id", sa.Integer(), sa.ForeignKey(_fk("guides.id"), name="fk_tours_guide_id"), nullable=True),
    ])
    with op.batch_alter_table("tours", schema=SCH) as batch:
        batch.alter_column("created_by", existing_type=sa.Integer(), nullable=True)
    _add_missing("car_rentals", [
        sa.Column("seats", sa.Integer(), nullable=True),
        sa.Column("transmission", sa.String(20), nullable=True),
    ])
    _add_missing("users", [sa.Column("clerk_user_id", sa.String(64), nullable=True)])
    op.create_index("ix_users_clerk_user_id", "users", ["clerk_user_id"], unique=True, schema=SCH)


def downgrade():
    op.drop_index("ix_users_clerk_user_id", "users", schema=SCH)
    drops = {
        "users": ["clerk_user_id"],
        "car_rentals": ["transmission", "seats"],
        "tours": ["guide_id", "destination_slug", "duration_hours", "category"],
        "hotels": ["is_active", "cleaning_fee", "min_nights"],
        "bookings": ["hold_expires_at", "payment_status", "updated_at", "currency", "nights", "reference"],
    }
    op.drop_index("ix_bookings_stripe_payment_intent_id", "bookings", schema=SCH)
    op.drop_index("ix_bookings_reference", "bookings", schema=SCH)
    for table, cols in drops.items():
        with op.batch_alter_table(table, schema=SCH) as batch:
            if table == "tours":
                batch.drop_constraint("fk_tours_guide_id", type_="foreignkey")
            for col in cols:
                batch.drop_column(col)
    op.drop_table("contact_messages", schema=SCH)
    op.drop_index("ix_trip_plans_share_id", "trip_plans", schema=SCH)
    op.drop_table("trip_plans", schema=SCH)
    op.drop_index("ix_guide_bookings_tour_date", "guide_bookings", schema=SCH)
    op.drop_index("ix_guide_bookings_reference", "guide_bookings", schema=SCH)
    op.drop_table("guide_bookings", schema=SCH)
    op.drop_index("ix_guides_slug", "guides", schema=SCH)
    op.drop_table("guides", schema=SCH)
