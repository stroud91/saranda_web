"""Business portal: partner businesses, their listings' ownership and review
state, and guest enquiries.

Revision ID: f7b2d90c4a13
Revises: e5a7c41b9d02
Create Date: 2026-11-12
"""
import sqlalchemy as sa
from alembic import op

from app.models.db import SCHEMA, USE_SCHEMA  # schema only on production PostgreSQL

SCH = SCHEMA if USE_SCHEMA else None

revision = "f7b2d90c4a13"
down_revision = "e5a7c41b9d02"
branch_labels = None
depends_on = None

LISTING_TABLES = ("hotels", "tours", "car_rentals")


def _fk(target):
    return f"{SCHEMA}.{target}" if SCH else target


def upgrade():
    op.create_table(
        "businesses",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("owner_id", sa.Integer(), sa.ForeignKey(_fk("users.id")), nullable=True),
        sa.Column("slug", sa.String(80), nullable=False),
        sa.Column("name", sa.String(120), nullable=False),
        sa.Column("tagline", sa.String(160), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("city", sa.String(80), nullable=True),
        sa.Column("address", sa.String(255), nullable=True),
        sa.Column("email", sa.String(255), nullable=True),
        sa.Column("phone", sa.String(40), nullable=True),
        sa.Column("whatsapp", sa.String(40), nullable=True),
        sa.Column("website", sa.String(255), nullable=True),
        sa.Column("palette", sa.String(20)),
        sa.Column("status", sa.String(20), nullable=False, server_default="pending"),
        sa.Column("review_note", sa.Text(), nullable=True),
        sa.Column("pending_changes", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime()),
        sa.Column("updated_at", sa.DateTime()),
        sa.Column("reviewed_at", sa.DateTime(), nullable=True),
        schema=SCH,
    )
    op.create_index("ix_businesses_owner_id", "businesses", ["owner_id"], unique=True, schema=SCH)
    op.create_index("ix_businesses_slug", "businesses", ["slug"], unique=True, schema=SCH)

    # Existing listings are the site's own, so they start out approved.
    for table in LISTING_TABLES:
        with op.batch_alter_table(table, schema=SCH) as batch:
            batch.add_column(sa.Column("business_id", sa.Integer(),
                                       sa.ForeignKey(_fk("businesses.id"), name=f"fk_{table}_business_id"), nullable=True))
            batch.add_column(sa.Column("review_status", sa.String(20), nullable=True, server_default="approved"))
            batch.add_column(sa.Column("review_note", sa.Text(), nullable=True))
            batch.add_column(sa.Column("pending_changes", sa.JSON(), nullable=True))
            if table == "car_rentals":
                batch.add_column(sa.Column("description", sa.Text(), nullable=True))
        op.create_index(f"ix_{table}_business_id", table, ["business_id"], schema=SCH)

    op.create_table(
        "enquiries",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("reference", sa.String(20)),
        sa.Column("business_id", sa.Integer(), sa.ForeignKey(_fk("businesses.id")), nullable=False),
        sa.Column("tour_id", sa.Integer(), sa.ForeignKey(_fk("tours.id")), nullable=True),
        sa.Column("car_id", sa.Integer(), sa.ForeignKey(_fk("car_rentals.id")), nullable=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey(_fk("users.id")), nullable=True),
        sa.Column("subject", sa.String(255), nullable=False),
        sa.Column("name", sa.String(120), nullable=False),
        sa.Column("email", sa.String(255), nullable=False),
        sa.Column("phone", sa.String(40), nullable=True),
        sa.Column("start_date", sa.Date(), nullable=True),
        sa.Column("end_date", sa.Date(), nullable=True),
        sa.Column("people", sa.Integer(), nullable=True),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column("status", sa.String(20)),
        sa.Column("created_at", sa.DateTime()),
        schema=SCH,
    )
    op.create_index("ix_enquiries_reference", "enquiries", ["reference"], unique=True, schema=SCH)
    op.create_index("ix_enquiries_business_id", "enquiries", ["business_id"], schema=SCH)
    op.create_index("ix_enquiries_user_id", "enquiries", ["user_id"], schema=SCH)


def downgrade():
    op.drop_index("ix_enquiries_user_id", "enquiries", schema=SCH)
    op.drop_index("ix_enquiries_business_id", "enquiries", schema=SCH)
    op.drop_index("ix_enquiries_reference", "enquiries", schema=SCH)
    op.drop_table("enquiries", schema=SCH)
    for table in LISTING_TABLES:
        op.drop_index(f"ix_{table}_business_id", table, schema=SCH)
        with op.batch_alter_table(table, schema=SCH) as batch:
            batch.drop_constraint(f"fk_{table}_business_id", type_="foreignkey")
            if table == "car_rentals":
                batch.drop_column("description")
            for col in ("pending_changes", "review_note", "review_status", "business_id"):
                batch.drop_column(col)
    op.drop_index("ix_businesses_slug", "businesses", schema=SCH)
    op.drop_index("ix_businesses_owner_id", "businesses", schema=SCH)
    op.drop_table("businesses", schema=SCH)
