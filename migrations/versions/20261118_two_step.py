"""Two-step sign-in: the authenticator secret (encrypted), replay guard and recovery codes.

Revision ID: e9f1a6c3b752
Revises: d7c2b95e4a18
Create Date: 2026-11-18
"""
import sqlalchemy as sa
from alembic import op

from app.models.db import SCHEMA, USE_SCHEMA  # schema only on production PostgreSQL

SCH = SCHEMA if USE_SCHEMA else None

revision = "e9f1a6c3b752"
down_revision = "d7c2b95e4a18"
branch_labels = None
depends_on = None

COLUMNS = (
    sa.Column("totp_secret", sa.String(255), nullable=True),
    sa.Column("totp_enabled_at", sa.DateTime(), nullable=True),
    sa.Column("totp_last_step", sa.BigInteger(), nullable=True),
    sa.Column("recovery_codes", sa.JSON(), nullable=True),
)


def upgrade():
    with op.batch_alter_table("users", schema=SCH) as batch:
        for column in COLUMNS:
            batch.add_column(column.copy())


def downgrade():
    with op.batch_alter_table("users", schema=SCH) as batch:
        for column in reversed(COLUMNS):
            batch.drop_column(column.name)
