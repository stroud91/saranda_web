from app.models import db, Tour, environment, SCHEMA
from sqlalchemy.sql import text
from datetime import datetime

# Adds detailed tour information for Saranda, Albania
def seed_tours():
    tour_1 = Tour(
        tour_name='Blue Eye Spring Tour',
        description='A guided tour to the famous Blue Eye spring, a natural wonder known for its crystal-clear blue waters.',
        price=30.00,
        start_date=datetime(2024, 5, 10, 9, 0),
        end_date=datetime(2024, 5, 10, 14, 0),
        created_by=1,
        location='Blue Eye, Saranda, Albania'
    )

    tour_2 = Tour(
        tour_name='Butrint Archaeological Park Tour',
        description='An excursion to the ancient city of Butrint, a UNESCO World Heritage site, featuring well-preserved ruins.',
        price=50.00,
        start_date=datetime(2024, 5, 15, 8, 0),
        end_date=datetime(2024, 5, 15, 15, 0),
        created_by=1,
        location='Butrint, Saranda, Albania'
    )

    tour_3 = Tour(
        tour_name='Hiking to Lekuresi Castle',
        description='A scenic hike up to Lekuresi Castle with stunning views of Saranda, Corfu Island, and the Ionian Sea.',
        price=25.00,
        start_date=datetime(2024, 6, 1, 10, 0),
        end_date=datetime(2024, 6, 1, 13, 0),
        created_by=1,
        location='Lekuresi Castle, Saranda, Albania'
    )

    tour_4 = Tour(
        tour_name='Saranda City Walking Tour',
        description='A guided walking tour around the city of Saranda, visiting key landmarks and learning about the local culture.',
        price=20.00,
        start_date=datetime(2024, 6, 5, 9, 0),
        end_date=datetime(2024, 6, 5, 12, 0),
        created_by=1,
        location='Saranda, Albania'
    )

    tour_5 = Tour(
        tour_name='Boat Tour to Ksamil Islands',
        description='A boat trip from Saranda to the beautiful Ksamil Islands, including time for swimming and relaxing on the beach.',
        price=80.00,
        start_date=datetime(2024, 6, 10, 10, 0),
        end_date=datetime(2024, 6, 10, 17, 0),
        created_by=1,
        location='Ksamil Islands, Saranda, Albania'
    )

    tour_6 = Tour(
        tour_name='Phoenice Archaeological Site Tour',
        description='A guided tour to the Phoenice Archaeological Site, exploring the ruins of the ancient city of Phoenice.',
        price=40.00,
        start_date=datetime(2024, 6, 20, 8, 0),
        end_date=datetime(2024, 6, 20, 13, 0),
        created_by=1,
        location='Phoenice, Saranda, Albania'
    )

    tour_7 = Tour(
        tour_name='Sunset Cruise along Saranda Coastline',
        description='Enjoy a relaxing sunset cruise along the beautiful coastline of Saranda, with drinks and snacks included.',
        price=70.00,
        start_date=datetime(2024, 7, 1, 19, 0),
        end_date=datetime(2024, 7, 1, 21, 0),
        created_by=1,
        location='Saranda Coastline, Albania'
    )

    tour_8 = Tour(
        tour_name='Visit to Monastery of 40 Saints',
        description='A visit to the historic Monastery of 40 Saints, with insights into its history and panoramic views of the area.',
        price=35.00,
        start_date=datetime(2024, 7, 5, 9, 0),
        end_date=datetime(2024, 7, 5, 12, 0),
        created_by=1,
        location='Monastery of 40 Saints, Saranda, Albania'
    )

    tour_9 = Tour(
        tour_name='Cooking Class: Traditional Albanian Cuisine',
        description='Learn to cook traditional Albanian dishes with a local chef and enjoy a delicious meal at the end.',
        price=55.00,
        start_date=datetime(2024, 7, 10, 11, 0),
        end_date=datetime(2024, 7, 10, 15, 0),
        created_by=1,
        location='Saranda, Albania'
    )

    tour_10 = Tour(
        tour_name='Borsh Waterfall and Village Tour',
        description='A day trip to visit the stunning Borsh Waterfall and explore the charming village of Borsh.',
        price=60.00,
        start_date=datetime(2024, 7, 15, 9, 0),
        end_date=datetime(2024, 7, 15, 16, 0),
        created_by=1,
        location='Borsh, near Saranda, Albania'
    )

    tour_11 = Tour(
        tour_name='Kayaking at Mirror Beach',
        description='A kayaking adventure at the beautiful Mirror Beach, with opportunities for swimming and exploring the coast.',
        price=45.00,
        start_date=datetime(2024, 7, 20, 9, 0),
        end_date=datetime(2024, 7, 20, 13, 0),
        created_by=1,
        location='Mirror Beach, Saranda, Albania'
    )

    tour_12 = Tour(
        tour_name='Off-Road Adventure to Gjirokaster',
        description='An exciting off-road adventure to the historic city of Gjirokaster, a UNESCO World Heritage site.',
        price=100.00,
        start_date=datetime(2024, 7, 25, 8, 0),
        end_date=datetime(2024, 7, 25, 18, 0),
        created_by=1,
        location='Gjirokaster, near Saranda, Albania'
    )

    tour_13 = Tour(
        tour_name='Jeep Safari in Albanian Riviera',
        description='A thrilling jeep safari through the rugged terrain of the Albanian Riviera, with stops at key scenic spots.',
        price=120.00,
        start_date=datetime(2024, 8, 1, 8, 0),
        end_date=datetime(2024, 8, 1, 17, 0),
        created_by=1,
        location='Albanian Riviera, near Saranda, Albania'
    )

    tour_14 = Tour(
        tour_name='Visit to Ali Pasha Castle',
        description='A visit to the historic Ali Pasha Castle, located at the entrance of Porto Palermo Bay.',
        price=30.00,
        start_date=datetime(2024, 8, 5, 9, 0),
        end_date=datetime(2024, 8, 5, 13, 0),
        created_by=1,
        location='Porto Palermo, near Saranda, Albania'
    )

    tour_15 = Tour(
        tour_name='Paragliding over Saranda',
        description='Experience the thrill of paragliding over Saranda with a certified instructor.',
        price=150.00,
        start_date=datetime(2024, 8, 10, 10, 0),
        end_date=datetime(2024, 8, 10, 12, 0),
        created_by=1,
        location='Saranda, Albania'
    )

    tour_16 = Tour(
        tour_name='Cycling Tour of Saranda',
        description='A cycling tour around Saranda, covering key attractions and beautiful coastal views.',
        price=40.00,
        start_date=datetime(2024, 8, 15, 9, 0),
        end_date=datetime(2024, 8, 15, 13, 0),
        created_by=1,
        location='Saranda, Albania'
    )

    tour_17 = Tour(
        tour_name='Snorkeling Adventure at Krorëz Beach',
        description='A snorkeling adventure at Krorëz Beach, with equipment provided and a guide to assist.',
        price=50.00,
        start_date=datetime(2024, 8, 20, 10, 0),
        end_date=datetime(2024, 8, 20, 14, 0),
        created_by=1,
        location='Krorëz Beach, near Saranda, Albania'
    )

    tour_18 = Tour(
        tour_name='Photography Tour: Best of Saranda',
        description='A guided photography tour taking you to the most picturesque spots in Saranda, led by a professional photographer.',
        price=70.00,
        start_date=datetime(2024, 8, 25, 8, 0),
        end_date=datetime(2024, 8, 25, 12, 0),
        created_by=1,
        location='Saranda, Albania'
    )

    tour_19 = Tour(
        tour_name='Wine Tasting at Local Vineyard',
        description='A visit to a local vineyard near Saranda, including a tour and wine tasting experience.',
        price=60.00,
        start_date=datetime(2024, 8, 30, 11, 0),
        end_date=datetime(2024, 8, 30, 15, 0),
        created_by=1,
        location='Vineyard near Saranda, Albania'
    )

    tour_20 = Tour(
        tour_name='Day Trip to Corfu Island',
        description='A full-day excursion to the Greek island of Corfu, including ferry tickets and guided tour.',
        price=120.00,
        start_date=datetime(2024, 9, 5, 7, 0),
        end_date=datetime(2024, 9, 5, 19, 0),
        created_by=1,
        location='Corfu Island, Greece'
    )

    tour_21 = Tour(
        tour_name='Rock Climbing at Dhermi',
        description='A rock climbing experience at Dhermi, with certified instructors and all necessary equipment.',
        price=85.00,
        start_date=datetime(2024, 9, 10, 9, 0),
        end_date=datetime(2024, 9, 10, 14, 0),
        created_by=1,
        location='Dhermi, near Saranda, Albania'
    )

    tour_22 = Tour(
        tour_name='Fishing Trip in Ionian Sea',
        description='A fishing trip in the Ionian Sea, with all equipment provided and a guide to assist.',
        price=75.00,
        start_date=datetime(2024, 9, 15, 6, 0),
        end_date=datetime(2024, 9, 15, 12, 0),
        created_by=1,
        location='Ionian Sea, Saranda, Albania'
    )

    tour_23 = Tour(
        tour_name='Day Trip to Permet Hot Springs',
        description='A relaxing day trip to the natural hot springs of Permet, with time to soak in the warm waters.',
        price=90.00,
        start_date=datetime(2024, 9, 20, 8, 0),
        end_date=datetime(2024, 9, 20, 18, 0),
        created_by=1,
        location='Permet, near Saranda, Albania'
    )

    tour_24 = Tour(
        tour_name='Olive Harvesting Experience',
        description='Participate in the olive harvesting process at a local olive farm, including a traditional lunch.',
        price=50.00,
        start_date=datetime(2024, 9, 25, 9, 0),
        end_date=datetime(2024, 9, 25, 15, 0),
        created_by=1,
        location='Olive Farm, near Saranda, Albania'
    )

    tour_25 = Tour(
        tour_name='Stargazing at Llogara Pass',
        description='A nighttime stargazing experience at Llogara Pass, with telescopes and a guide to explain the constellations.',
        price=65.00,
        start_date=datetime(2024, 9, 30, 21, 0),
        end_date=datetime(2024, 9, 30, 23, 0),
        created_by=1,
        location='Llogara Pass, near Saranda, Albania'
    )

    db.session.add_all([
        tour_1, tour_2, tour_3, tour_4, tour_5, tour_6, tour_7, tour_8, tour_9, tour_10,
        tour_11, tour_12, tour_13, tour_14, tour_15, tour_16, tour_17, tour_18, tour_19, tour_20,
        tour_21, tour_22, tour_23, tour_24, tour_25
    ])
    db.session.commit()

# Uses a raw SQL query to TRUNCATE or DELETE the tours table
def undo_tours():
    if environment == "production":
        db.session.execute(f"TRUNCATE table {SCHEMA}.tours RESTART IDENTITY CASCADE;")
    else:
        db.session.execute(text("DELETE FROM tours"))
    
    db.session.commit()
