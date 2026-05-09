from app.models import db, Hotel, environment, SCHEMA
from sqlalchemy.sql import text

COMMON_AMENITIES = [
    "Free WiFi", "Air Conditioning", "Sea View", "Fully Equipped Kitchen",
    "Smart TV", "Washing Machine", "Balcony", "Premium Linens & Towels",
    "Hot Shower", "Iron & Ironing Board"
]

ADDRESS = "Rruga Gjergj Araniti, Sarandë, Albanian Riviera"
CITY = "Sarandë"


def seed_hotels():
    apt_4 = Hotel(
        hotel_name="Apartment 4 — Sea View",
        apartment_number=4,
        apartment_name="Sea View",
        address=ADDRESS,
        city=CITY,
        price_per_night=65.00,
        total_rooms=1,
        available_rooms=1,
        contact_email="bookings@megrooms.com",
        bedrooms=1,
        beds=1,
        bathrooms=1.5,
        max_guests=3,
        tag=None,
        rating_source="Airbnb",
        airbnb_rating=4.74,
        description=(
            "Wake up to stunning Ionian Sea views in this bright, well-equipped studio. "
            "Apartment 4 features a private balcony overlooking Sarandë Bay, a modern kitchen, "
            "and everything you need for a perfect getaway. Just steps from the promenade and local restaurants."
        ),
        amenities=COMMON_AMENITIES,
        image_urls=[],
    )

    apt_11 = Hotel(
        hotel_name="Apartment 11 — Family Suite",
        apartment_number=11,
        apartment_name="Family Suite",
        address=ADDRESS,
        city=CITY,
        price_per_night=85.00,
        total_rooms=1,
        available_rooms=1,
        contact_email="bookings@megrooms.com",
        bedrooms=2,
        beds=2,
        bathrooms=1.0,
        max_guests=6,
        tag="Best for Families",
        rating_source="Airbnb",
        airbnb_rating=4.58,
        description=(
            "Spacious two-bedroom apartment ideal for families and groups. "
            "Apartment 11 offers two comfortable bedrooms, a fully equipped kitchen, "
            "a large living area with a Smart TV, and direct views of the Ionian coast. "
            "Located in the heart of Sarandë, close to beaches, restaurants, and activities."
        ),
        amenities=COMMON_AMENITIES + ["Kids Welcome", "Extra Bedding Available"],
        image_urls=[],
    )

    apt_17 = Hotel(
        hotel_name="Apartment 17 — Panoramic View",
        apartment_number=17,
        apartment_name="Panoramic View",
        address=ADDRESS,
        city=CITY,
        price_per_night=45.00,
        total_rooms=1,
        available_rooms=1,
        contact_email="bookings@megrooms.com",
        bedrooms=3,
        beds=3,
        bathrooms=2.0,
        max_guests=6,
        tag=None,
        rating_source="Airbnb",
        airbnb_rating=4.81,
        description=(
            "Our most spacious option — a three-bedroom apartment with sweeping 270° panoramic "
            "views of the Albanian Riviera and Corfu Island. Apartment 17 is perfect for larger "
            "families or groups who want the comfort of a real home. Two full bathrooms, a generous "
            "living space, and a private terrace to enjoy the Adriatic sunsets."
        ),
        amenities=COMMON_AMENITIES + ["Terrace", "Sea & Mountain Views", "Dining Area"],
        image_urls=[],
    )

    apt_23 = Hotel(
        hotel_name="Apartment 23 — Sunset Studio",
        apartment_number=23,
        apartment_name="Sunset Studio",
        address=ADDRESS,
        city=CITY,
        price_per_night=75.00,
        total_rooms=1,
        available_rooms=1,
        contact_email="bookings@megrooms.com",
        bedrooms=1,
        beds=1,
        bathrooms=1.0,
        max_guests=4,
        tag="Romantic Getaway",
        rating_source="Airbnb",
        airbnb_rating=4.69,
        description=(
            "Designed for romance and relaxation, Apartment 23 faces west to capture Sarandë's "
            "legendary golden sunsets over the Ionian Sea. The cozy studio layout features "
            "a queen bed, a kitchenette, and a curtained window seat perfect for watching the "
            "sun dip below the horizon. An ideal escape for couples."
        ),
        amenities=COMMON_AMENITIES + ["Sunset Views", "Queen Bed", "Romantic Ambiance"],
        image_urls=[],
    )

    apt_booking = Hotel(
        hotel_name="Two-Bedroom Apartment",
        apartment_number=None,
        apartment_name="Two-Bedroom Apartment",
        address=ADDRESS,
        city=CITY,
        price_per_night=95.00,
        total_rooms=1,
        available_rooms=1,
        contact_email="bookings@megrooms.com",
        bedrooms=2,
        beds=2,
        bathrooms=1.0,
        max_guests=5,
        tag="Wonderful · 9.2",
        rating_source="Booking.com",
        airbnb_rating=9.2,
        description=(
            "Our top-rated apartment on Booking.com — rated Wonderful 9.2/10 by verified guests. "
            "This two-bedroom gem features a fully equipped kitchen, a bright living room, "
            "and beautiful sea views. Scored top marks for cleanliness, location, and host responsiveness. "
            "Perfect for families or a group of friends seeking a premium Sarandë experience."
        ),
        amenities=COMMON_AMENITIES + ["Booking.com Verified", "Top-Rated Cleanliness"],
        image_urls=[],
    )

    db.session.add_all([apt_4, apt_11, apt_17, apt_23, apt_booking])
    db.session.commit()


def undo_hotels():
    if environment == "production":
        db.session.execute(text(f"TRUNCATE table {SCHEMA}.hotels RESTART IDENTITY CASCADE;"))
    else:
        db.session.execute(text("DELETE FROM hotels"))
    db.session.commit()
