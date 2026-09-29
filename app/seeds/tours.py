from datetime import datetime

from app.models import Tour, db

from ._util import truncate

# (name, description, price €, start hour, duration h, category, destination slug, location)
TOURS = [
    ('Blue Eye Spring Tour',
     'A guided tour to the famous Blue Eye spring, a natural wonder known for its crystal-clear blue waters.',
     30.0, 9, 5.0, 'nature', 'blue-eye', 'Blue Eye, Saranda, Albania'),
    ('Butrint Archaeological Park Tour',
     'An excursion to the ancient city of Butrint, a UNESCO World Heritage site, featuring well-preserved ruins.',
     50.0, 8, 7.0, 'history', 'butrint', 'Butrint, Saranda, Albania'),
    ('Hiking to Lekuresi Castle',
     'A scenic hike up to Lekuresi Castle with stunning views of Saranda, Corfu Island, and the Ionian Sea.',
     25.0, 10, 3.0, 'active', 'lekures-castle', 'Lekuresi Castle, Saranda, Albania'),
    ('Saranda City Walking Tour',
     'A guided walking tour around the city of Saranda, visiting key landmarks and learning about the local culture.',
     20.0, 9, 3.0, 'culture', 'sarande', 'Saranda, Albania'),
    ('Boat Tour to Ksamil Islands',
     'A boat trip from Saranda to the beautiful Ksamil Islands, including time for swimming and relaxing on the beach.',
     80.0, 10, 7.0, 'boat', 'ksamil', 'Ksamil Islands, Saranda, Albania'),
    ('Phoenice Archaeological Site Tour',
     'A guided tour to the Phoenice Archaeological Site, exploring the ruins of the ancient city of Phoenice.',
     40.0, 8, 5.0, 'history', 'sarande', 'Phoenice, Saranda, Albania'),
    ('Sunset Cruise along Saranda Coastline',
     'Enjoy a relaxing sunset cruise along the beautiful coastline of Saranda, with drinks and snacks included.',
     70.0, 19, 2.0, 'boat', 'sarande', 'Saranda Coastline, Albania'),
    ('Visit to Monastery of 40 Saints',
     'A visit to the historic Monastery of 40 Saints, with insights into its history and panoramic views of the area.',
     35.0, 9, 3.0, 'history', 'sarande', 'Monastery of 40 Saints, Saranda, Albania'),
    ('Cooking Class: Traditional Albanian Cuisine',
     'Learn to cook traditional Albanian dishes with a local chef and enjoy a delicious meal at the end.',
     55.0, 11, 4.0, 'food', 'sarande', 'Saranda, Albania'),
    ('Borsh Waterfall and Village Tour',
     'A day trip to visit the stunning Borsh Waterfall and explore the charming village of Borsh.',
     60.0, 9, 7.0, 'nature', 'borsh', 'Borsh, near Saranda, Albania'),
    ('Kayaking at Mirror Beach',
     'A kayaking adventure at the beautiful Mirror Beach, with opportunities for swimming and exploring the coast.',
     45.0, 9, 4.0, 'active', 'ksamil', 'Mirror Beach, Saranda, Albania'),
    ('Off-Road Adventure to Gjirokaster',
     'An exciting off-road adventure to the historic city of Gjirokaster, a UNESCO World Heritage site.',
     100.0, 8, 10.0, 'active', 'gjirokaster', 'Gjirokaster, near Saranda, Albania'),
    ('Jeep Safari in Albanian Riviera',
     'A thrilling jeep safari through the rugged terrain of the Albanian Riviera, with stops at key scenic spots.',
     120.0, 8, 9.0, 'active', 'himare', 'Albanian Riviera, near Saranda, Albania'),
    ('Visit to Ali Pasha Castle',
     'A visit to the historic Ali Pasha Castle, located at the entrance of Porto Palermo Bay.',
     30.0, 9, 4.0, 'history', 'porto-palermo', 'Porto Palermo, near Saranda, Albania'),
    ('Paragliding over Saranda',
     'Experience the thrill of paragliding over Saranda with a certified instructor.',
     150.0, 10, 2.0, 'active', 'sarande', 'Saranda, Albania'),
    ('Cycling Tour of Saranda',
     'A cycling tour around Saranda, covering key attractions and beautiful coastal views.',
     40.0, 9, 4.0, 'active', 'sarande', 'Saranda, Albania'),
    ('Snorkeling Adventure at Krorëz Beach',
     'A snorkeling adventure at Krorëz Beach, with equipment provided and a guide to assist.',
     50.0, 10, 4.0, 'boat', 'kroreza', 'Krorëz Beach, near Saranda, Albania'),
    ('Photography Tour: Best of Saranda',
     'A guided photography tour taking you to the most picturesque spots in Saranda, led by a professional photographer.',
     70.0, 8, 4.0, 'culture', 'sarande', 'Saranda, Albania'),
    ('Wine Tasting at Local Vineyard',
     'A visit to a local vineyard near Saranda, including a tour and wine tasting experience.',
     60.0, 11, 4.0, 'food', 'mesopotam', 'Vineyard near Saranda, Albania'),
    ('Day Trip to Corfu Island',
     'A full-day excursion to the Greek island of Corfu, including ferry tickets and guided tour.',
     120.0, 7, 12.0, 'boat', 'corfu', 'Corfu Island, Greece'),
    ('Rock Climbing at Dhermi',
     'A rock climbing experience at Dhermi, with certified instructors and all necessary equipment.',
     85.0, 9, 5.0, 'active', 'dhermi', 'Dhermi, near Saranda, Albania'),
    ('Fishing Trip in Ionian Sea',
     'A fishing trip in the Ionian Sea, with all equipment provided and a guide to assist.',
     75.0, 6, 6.0, 'boat', 'sarande', 'Ionian Sea, Saranda, Albania'),
    ('Day Trip to Permet Hot Springs',
     'A relaxing day trip to the natural hot springs of Permet, with time to soak in the warm waters.',
     90.0, 8, 10.0, 'nature', 'gjirokaster', 'Permet, near Saranda, Albania'),
    ('Olive Harvesting Experience',
     'Participate in the olive harvesting process at a local olive farm, including a traditional lunch.',
     50.0, 9, 6.0, 'food', 'sarande', 'Olive Farm, near Saranda, Albania'),
    ('Stargazing at Llogara Pass',
     'A nighttime stargazing experience at Llogara Pass, with telescopes and a guide to explain the constellations.',
     65.0, 21, 2.0, 'nature', 'llogara', 'Llogara Pass, near Saranda, Albania'),
]


def seed_tours():
    rows = []
    for name, desc, price, hour, hours, cat, slug, loc in TOURS:
        start = datetime(2027, 5, 1, hour, 0)
        rows.append(Tour(tour_name=name, description=desc, price=price, start_date=start, end_date=start,
                         duration_hours=hours, category=cat, destination_slug=slug, location=loc, is_available=True))
    db.session.add_all(rows)
    db.session.commit()


def undo_tours():
    truncate("tours")
