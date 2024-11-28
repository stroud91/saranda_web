from app.models import db, Booking, environment, SCHEMA
from sqlalchemy.sql import text
from datetime import datetime

# Adds booking information for Saranda, Albania (initially empty, to be populated later as bookings are made)
def seed_bookings():
    # No initial bookings as bookings will be created dynamically by users.
    pass

# Uses a raw SQL query to TRUNCATE or DELETE the bookings table
def undo_bookings():
    if environment == "production":
        db.session.execute(f"TRUNCATE table {SCHEMA}.bookings RESTART IDENTITY CASCADE;")
    else:
        db.session.execute(text("DELETE FROM bookings"))
    
    db.session.commit()