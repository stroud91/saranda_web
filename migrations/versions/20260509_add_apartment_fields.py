"""add apartment fields to hotels and guest fields to bookings

Revision ID: a4c8f20d9b3e
Revises: ffdc0a98111c
Create Date: 2026-05-09

"""
from alembic import op
import sqlalchemy as sa
import os

from app.models.db import SCHEMA, USE_SCHEMA  # schema only on production PostgreSQL

revision = 'a4c8f20d9b3e'
down_revision = 'ffdc0a98111c'
branch_labels = None
depends_on = None


def upgrade():
    # Add apartment fields to hotels table
    with op.batch_alter_table('hotels', schema=SCHEMA if USE_SCHEMA else None) as batch_op:
        batch_op.add_column(sa.Column('apartment_number', sa.Integer(), nullable=True))
        batch_op.add_column(sa.Column('apartment_name', sa.String(255), nullable=True))
        batch_op.add_column(sa.Column('bedrooms', sa.Integer(), nullable=True, server_default='1'))
        batch_op.add_column(sa.Column('beds', sa.Integer(), nullable=True, server_default='1'))
        batch_op.add_column(sa.Column('bathrooms', sa.Numeric(3, 1), nullable=True, server_default='1.0'))
        batch_op.add_column(sa.Column('max_guests', sa.Integer(), nullable=True, server_default='2'))
        batch_op.add_column(sa.Column('tag', sa.String(100), nullable=True))
        batch_op.add_column(sa.Column('rating_source', sa.String(50), nullable=True, server_default='Airbnb'))
        batch_op.add_column(sa.Column('airbnb_rating', sa.Numeric(4, 2), nullable=True))
        batch_op.add_column(sa.Column('image_urls', sa.JSON(), nullable=True))
        batch_op.add_column(sa.Column('description', sa.Text(), nullable=True))
        batch_op.add_column(sa.Column('amenities', sa.JSON(), nullable=True))

    # The initial migration never created `bookings`, so create it here when
    # missing (fresh databases) and only alter it when it already exists.
    if not sa.inspect(op.get_bind()).has_table('bookings', schema=SCHEMA if USE_SCHEMA else None):
        op.create_table('bookings',
            sa.Column('id', sa.Integer(), primary_key=True),
            sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=True),
            sa.Column('tour_id', sa.Integer(), sa.ForeignKey('tours.id'), nullable=True),
            sa.Column('hotel_id', sa.Integer(), sa.ForeignKey('hotels.id'), nullable=True),
            sa.Column('car_id', sa.Integer(), sa.ForeignKey('car_rentals.id'), nullable=True),
            sa.Column('start_date', sa.DateTime(), nullable=False),
            sa.Column('end_date', sa.DateTime(), nullable=False),
            sa.Column('total_cost', sa.Numeric(10, 2), nullable=False),
            sa.Column('created_at', sa.DateTime()),
            sa.Column('status', sa.String(50)),
            sa.Column('guest_name', sa.String(255), nullable=True),
            sa.Column('guest_email', sa.String(255), nullable=True),
            sa.Column('guest_phone', sa.String(50), nullable=True),
            sa.Column('guest_count', sa.Integer(), nullable=True),
            sa.Column('notes', sa.Text(), nullable=True),
            sa.Column('stripe_payment_intent_id', sa.String(255), nullable=True),
        )
        if USE_SCHEMA:
            op.execute(f"ALTER TABLE bookings SET SCHEMA {SCHEMA};")
        return

    # Add guest checkout fields to bookings table + make user_id nullable
    with op.batch_alter_table('bookings', schema=SCHEMA if USE_SCHEMA else None) as batch_op:
        batch_op.alter_column('user_id', existing_type=sa.Integer(), nullable=True)
        batch_op.add_column(sa.Column('guest_name', sa.String(255), nullable=True))
        batch_op.add_column(sa.Column('guest_email', sa.String(255), nullable=True))
        batch_op.add_column(sa.Column('guest_phone', sa.String(50), nullable=True))
        batch_op.add_column(sa.Column('guest_count', sa.Integer(), nullable=True))
        batch_op.add_column(sa.Column('notes', sa.Text(), nullable=True))
        batch_op.add_column(sa.Column('stripe_payment_intent_id', sa.String(255), nullable=True))


def downgrade():
    with op.batch_alter_table('bookings', schema=SCHEMA if USE_SCHEMA else None) as batch_op:
        batch_op.drop_column('stripe_payment_intent_id')
        batch_op.drop_column('notes')
        batch_op.drop_column('guest_count')
        batch_op.drop_column('guest_phone')
        batch_op.drop_column('guest_email')
        batch_op.drop_column('guest_name')
        batch_op.alter_column('user_id', existing_type=sa.Integer(), nullable=False)

    with op.batch_alter_table('hotels', schema=SCHEMA if USE_SCHEMA else None) as batch_op:
        batch_op.drop_column('amenities')
        batch_op.drop_column('description')
        batch_op.drop_column('image_urls')
        batch_op.drop_column('airbnb_rating')
        batch_op.drop_column('rating_source')
        batch_op.drop_column('tag')
        batch_op.drop_column('max_guests')
        batch_op.drop_column('bathrooms')
        batch_op.drop_column('beds')
        batch_op.drop_column('bedrooms')
        batch_op.drop_column('apartment_name')
        batch_op.drop_column('apartment_number')
