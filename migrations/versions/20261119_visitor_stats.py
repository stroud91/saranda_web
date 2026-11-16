"""Visitor statistics without cookies: daily counters and one-day visitor codes.

Revision ID: f2b4d8a70c63
Revises: e9f1a6c3b752
Create Date: 2026-11-19
"""
import sqlalchemy as sa
from alembic import op

from app.models.db import SCHEMA, USE_SCHEMA  # schema only on production PostgreSQL

SCH = SCHEMA if USE_SCHEMA else None

revision = "f2b4d8a70c63"
down_revision = "e9f1a6c3b752"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "stat_counters",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("day", sa.Date(), nullable=False),
        sa.Column("kind", sa.String(10), nullable=False),
        sa.Column("key", sa.String(120), nullable=False, server_default=""),
        sa.Column("count", sa.Integer(), nullable=False, server_default="0"),
        sa.UniqueConstraint("day", "kind", "key", name="uq_stat_counters_day_kind_key"),
        schema=SCH,
    )
    op.create_index("ix_stat_counters_day", "stat_counters", ["day"], schema=SCH)
    op.create_table(
        "stat_visitors",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("day", sa.Date(), nullable=False),
        sa.Column("code", sa.String(32), nullable=False),
        sa.UniqueConstraint("day", "code", name="uq_stat_visitors_day_code"),
        schema=SCH,
    )
    op.create_index("ix_stat_visitors_day", "stat_visitors", ["day"], schema=SCH)


def downgrade():
    op.drop_index("ix_stat_visitors_day", table_name="stat_visitors", schema=SCH)
    op.drop_table("stat_visitors", schema=SCH)
    op.drop_index("ix_stat_counters_day", table_name="stat_counters", schema=SCH)
    op.drop_table("stat_counters", schema=SCH)
