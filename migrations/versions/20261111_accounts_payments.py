"""Guest accounts (sessions, one-time tokens, sign-in throttling) and payment
methods beyond Stripe (PayPal, bank transfer, deposits).

Revision ID: e5a7c41b9d02
Revises: c3f1a9d27e10
Create Date: 2026-11-11
"""
import sqlalchemy as sa
from alembic import op

from app.models.db import SCHEMA, USE_SCHEMA  # schema only on production PostgreSQL

SCH = SCHEMA if USE_SCHEMA else None

revision = "e5a7c41b9d02"
down_revision = "c3f1a9d27e10"
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
    _add_missing("users", [
        sa.Column("name", sa.String(120), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=True),
        sa.Column("email_verified_at", sa.DateTime(), nullable=True),
        sa.Column("last_login_at", sa.DateTime(), nullable=True),
        sa.Column("password_changed_at", sa.DateTime(), nullable=True),
    ])

    op.create_table(
        "user_sessions",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey(_fk("users.id"), ondelete="CASCADE"), nullable=False),
        sa.Column("token_hash", sa.String(64), nullable=False),
        sa.Column("user_agent", sa.String(200), nullable=True),
        sa.Column("remember", sa.Boolean()),
        sa.Column("created_at", sa.DateTime()),
        sa.Column("last_seen_at", sa.DateTime()),
        sa.Column("expires_at", sa.DateTime(), nullable=False),
        sa.Column("revoked_at", sa.DateTime(), nullable=True),
        schema=SCH,
    )
    op.create_index("ix_user_sessions_user_id", "user_sessions", ["user_id"], schema=SCH)
    op.create_index("ix_user_sessions_token_hash", "user_sessions", ["token_hash"], unique=True, schema=SCH)

    op.create_table(
        "auth_tokens",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey(_fk("users.id"), ondelete="CASCADE"), nullable=False),
        sa.Column("purpose", sa.String(20), nullable=False),
        sa.Column("token_hash", sa.String(64), nullable=False),
        sa.Column("created_at", sa.DateTime()),
        sa.Column("expires_at", sa.DateTime(), nullable=False),
        sa.Column("used_at", sa.DateTime(), nullable=True),
        schema=SCH,
    )
    op.create_index("ix_auth_tokens_user_id", "auth_tokens", ["user_id"], schema=SCH)
    op.create_index("ix_auth_tokens_token_hash", "auth_tokens", ["token_hash"], unique=True, schema=SCH)

    op.create_table(
        "login_throttles",
        sa.Column("key_hash", sa.String(64), primary_key=True),
        sa.Column("failures", sa.Integer(), nullable=False),
        sa.Column("window_start", sa.DateTime(), nullable=False),
        sa.Column("locked_until", sa.DateTime(), nullable=True),
        schema=SCH,
    )

    _add_missing("bookings", [
        sa.Column("payment_method", sa.String(20), nullable=True),
        sa.Column("payment_ref", sa.String(64), nullable=True),
        sa.Column("amount_due", sa.Numeric(10, 2), nullable=True),
        sa.Column("charge_currency", sa.String(3), nullable=True),
        sa.Column("charge_amount", sa.Numeric(10, 2), nullable=True),
        sa.Column("transfer_claimed_at", sa.DateTime(), nullable=True),
        sa.Column("paid_at", sa.DateTime(), nullable=True),
    ])
    op.create_index("ix_bookings_payment_ref", "bookings", ["payment_ref"], schema=SCH)

    _add_missing("guide_bookings", [
        sa.Column("user_id", sa.Integer(), sa.ForeignKey(_fk("users.id"), name="fk_guide_bookings_user_id"), nullable=True),
    ])
    op.create_index("ix_guide_bookings_user_id", "guide_bookings", ["user_id"], schema=SCH)

    _add_missing("trip_plans", [
        sa.Column("user_id", sa.Integer(), sa.ForeignKey(_fk("users.id"), name="fk_trip_plans_user_id"), nullable=True),
    ])
    op.create_index("ix_trip_plans_user_id", "trip_plans", ["user_id"], schema=SCH)


def downgrade():
    op.drop_index("ix_trip_plans_user_id", "trip_plans", schema=SCH)
    with op.batch_alter_table("trip_plans", schema=SCH) as batch:
        batch.drop_constraint("fk_trip_plans_user_id", type_="foreignkey")
        batch.drop_column("user_id")
    op.drop_index("ix_guide_bookings_user_id", "guide_bookings", schema=SCH)
    with op.batch_alter_table("guide_bookings", schema=SCH) as batch:
        batch.drop_constraint("fk_guide_bookings_user_id", type_="foreignkey")
        batch.drop_column("user_id")
    op.drop_index("ix_bookings_payment_ref", "bookings", schema=SCH)
    with op.batch_alter_table("bookings", schema=SCH) as batch:
        for col in ("paid_at", "transfer_claimed_at", "charge_amount", "charge_currency", "amount_due",
                    "payment_ref", "payment_method"):
            batch.drop_column(col)
    op.drop_table("login_throttles", schema=SCH)
    op.drop_index("ix_auth_tokens_token_hash", "auth_tokens", schema=SCH)
    op.drop_index("ix_auth_tokens_user_id", "auth_tokens", schema=SCH)
    op.drop_table("auth_tokens", schema=SCH)
    op.drop_index("ix_user_sessions_token_hash", "user_sessions", schema=SCH)
    op.drop_index("ix_user_sessions_user_id", "user_sessions", schema=SCH)
    op.drop_table("user_sessions", schema=SCH)
    with op.batch_alter_table("users", schema=SCH) as batch:
        for col in ("password_changed_at", "last_login_at", "email_verified_at", "is_active", "name"):
            batch.drop_column(col)
