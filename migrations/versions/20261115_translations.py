"""Names and descriptions of listings, guides and businesses in other languages.

Revision ID: b3d7f2a91c10
Revises: a91c5e0d7b24
Create Date: 2026-11-15
"""
import sqlalchemy as sa
from alembic import op

from app.models.db import SCHEMA, USE_SCHEMA  # schema only on production PostgreSQL

SCH = SCHEMA if USE_SCHEMA else None

revision = "b3d7f2a91c10"
down_revision = "a91c5e0d7b24"
branch_labels = None
depends_on = None

TABLES = ("hotels", "tours", "car_rentals", "guides", "businesses")


def upgrade():
    for table in TABLES:
        with op.batch_alter_table(table, schema=SCH) as batch:
            batch.add_column(sa.Column("translations", sa.JSON(), nullable=True))


def downgrade():
    for table in TABLES:
        with op.batch_alter_table(table, schema=SCH) as batch:
            batch.drop_column("translations")
