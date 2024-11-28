from app.models import db, Hotel, environment, SCHEMA
from sqlalchemy.sql import text


def seed_hotels():
    hotel_1 = Hotel(
        hotel_name='Bougainville Bay Hotel',
        address='Rruga Butrinti, Saranda, Albania',
        price_per_night=120.00,
        total_rooms=50,
        available_rooms=50,
        city='Saranda',
        contact_email='info@bougainville.com'
    )

    hotel_2 = Hotel(
        hotel_name='Hotel Brilant',
        address='Lagja 1, Rruga Bilal Golemi, Saranda, Albania',
        price_per_night=90.00,
        total_rooms=30,
        available_rooms=30,
        city='Saranda',
        contact_email='contact@hotelbrilant.com'
    )

    hotel_3 = Hotel(
        hotel_name='Santa Quaranta Premium Resort',
        address='Rruga Butrinti, Saranda, Albania',
        price_per_night=150.00,
        total_rooms=80,
        available_rooms=80,
        city='Saranda',
        contact_email='reservations@santaquaranta.com'
    )

    hotel_4 = Hotel(
        hotel_name='Hotel Bahamas',
        address='Rruga Butrinti, Km 2, Saranda, Albania',
        price_per_night=70.00,
        total_rooms=40,
        available_rooms=40,
        city='Saranda',
        contact_email='booking@hotelbahamas.com'
    )

    hotel_5 = Hotel(
        hotel_name='Hotel Butrinti',
        address='Rruga Naim Frasheri, Saranda, Albania',
        price_per_night=110.00,
        total_rooms=60,
        available_rooms=60,
        city='Saranda',
        contact_email='info@hotelbutrinti.com'
    )

    db.session.add(hotel_1)
    db.session.add(hotel_2)
    db.session.add(hotel_3)
    db.session.add(hotel_4)
    db.session.add(hotel_5)
    db.session.commit()

# Uses a raw SQL query to TRUNCATE or DELETE the hotels table
# With postgres in production TRUNCATE removes all data from the table
# and RESET IDENTITY resets the auto-incrementing primary key, CASCADE deletes any dependent entities
# With sqlite3 in development you need to instead use DELETE to remove all data and it will reset the primary keys for you as well
def undo_hotels():
    if environment == "production":
        db.session.execute(f"TRUNCATE table {SCHEMA}.hotels RESTART IDENTITY CASCADE;")
    else:
        db.session.execute(text("DELETE FROM hotels"))
    
    db.session.commit()