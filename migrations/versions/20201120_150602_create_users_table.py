"""
create_users_table

Revision ID: ffdc0a98111c
Revises:
Create Date: 2024-11-28
"""

from alembic import op
import sqlalchemy as sa
import os

# Environment configuration
environment = os.getenv("FLASK_ENV")
SCHEMA = os.environ.get("SCHEMA")

# Revision identifiers, used by Alembic
revision = 'ffdc0a98111c'
down_revision = None
branch_labels = None
depends_on = None

def upgrade():
    # Create users table
    op.create_table('users',
        sa.Column('id', sa.dialects.postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column('username', sa.String(255), unique=True, nullable=False),
        sa.Column('email', sa.String(255), unique=True, nullable=False),
        sa.Column('password_hash', sa.String(255), nullable=False),
        sa.Column('role', sa.String(50), default='guest'),
        sa.Column('created_at', sa.DateTime(), default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), default=sa.func.now(), onupdate=sa.func.now()),
        sa.Column('phone_number', sa.String(20)),
        sa.Column('is_verified', sa.Boolean(), default=False)
    )

    # Create tours table
    op.create_table('tours',
        sa.Column('id', sa.dialects.postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column('tour_name', sa.String(255), nullable=False),
        sa.Column('description', sa.Text(), nullable=False),
        sa.Column('price', sa.Numeric(10, 2), nullable=False),
        sa.Column('start_date', sa.DateTime(), nullable=False),
        sa.Column('end_date', sa.DateTime(), nullable=False),
        sa.Column('created_by', sa.dialects.postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('created_at', sa.DateTime(), default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), default=sa.func.now(), onupdate=sa.func.now()),
        sa.Column('location', sa.String(255), nullable=False),
        sa.Column('is_available', sa.Boolean(), default=True)
    )

    # Create hotels table
    op.create_table('hotels',
        sa.Column('id', sa.dialects.postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column('hotel_name', sa.String(255), nullable=False),
        sa.Column('address', sa.String(255), nullable=False),
        sa.Column('price_per_night', sa.Numeric(10, 2), nullable=False),
        sa.Column('total_rooms', sa.Integer(), nullable=False),
        sa.Column('available_rooms', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(), default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), default=sa.func.now(), onupdate=sa.func.now()),
        sa.Column('city', sa.String(255), nullable=False),
        sa.Column('contact_email', sa.String(255))
    )

    # Create car_rentals table
    op.create_table('car_rentals',
        sa.Column('id', sa.dialects.postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column('car_model', sa.String(255), nullable=False),
        sa.Column('car_type', sa.String(50), nullable=False),
        sa.Column('price_per_day', sa.Numeric(10, 2), nullable=False),
        sa.Column('availability_status', sa.String(50), default='available'),
        sa.Column('created_at', sa.DateTime(), default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), default=sa.func.now(), onupdate=sa.func.now()),
        sa.Column('rental_company', sa.String(255), nullable=False),
        sa.Column('location', sa.String(255), nullable=False)
    )

    if environment == "production":
        op.execute(f"ALTER TABLE users SET SCHEMA {SCHEMA};")
        op.execute(f"ALTER TABLE tours SET SCHEMA {SCHEMA};")
        op.execute(f"ALTER TABLE hotels SET SCHEMA {SCHEMA};")
        op.execute(f"ALTER TABLE car_rentals SET SCHEMA {SCHEMA};")

def downgrade():
    op.drop_table('car_rentals')
    op.drop_table('hotels')
    op.drop_table('tours')
    op.drop_table('users')
