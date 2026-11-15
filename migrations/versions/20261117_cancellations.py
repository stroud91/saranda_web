"""Cancellations and refunds: who cancelled, what is owed back, and whether it was sent.

Revision ID: d7c2b95e4a18
Revises: c5a8e41d9f37
Create Date: 2026-11-17
"""
import sqlalchemy as sa
from alembic import op

from app.models.db import SCHEMA, USE_SCHEMA  # schema only on production PostgreSQL

SCH = SCHEMA if USE_SCHEMA else None

revision = "d7c2b95e4a18"
down_revision = "c5a8e41d9f37"
branch_labels = None
depends_on = None

COLUMNS = (
    sa.Column("cancelled_at", sa.DateTime(), nullable=True),
    sa.Column("cancelled_by", sa.String(10), nullable=True),
    sa.Column("refund_amount", sa.Numeric(10, 2), nullable=True),
    sa.Column("refund_status", sa.String(12), nullable=True),
    sa.Column("refunded_at", sa.DateTime(), nullable=True),
    sa.Column("refund_ref", sa.String(64), nullable=True),
)


def upgrade():
    with op.batch_alter_table("bookings", schema=SCH) as batch:
        for column in COLUMNS:
            batch.add_column(column.copy())


def downgrade():
    with op.batch_alter_table("bookings", schema=SCH) as batch:
        for column in reversed(COLUMNS):
            batch.drop_column(column.name)
