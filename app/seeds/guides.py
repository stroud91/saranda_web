"""Sample guide profiles.

These are placeholders that demonstrate the guide marketplace. They are
flagged ``is_sample=True`` (shown with a "Sample profile" badge in the UI) and
carry no ratings or reviews. Replace them with real, vetted guides via the
admin API before launch.
"""
from app.models import Guide, db

from ._util import truncate

GUIDES = [
    dict(slug="arben-history", name="Arben K.", palette="aegean",
         headline="Archaeologist-guide for Butrint & ancient Epirus",
         bio=("Trained in archaeology, Arben brings Butrint's Greek, Roman, Byzantine and Venetian layers to life. "
              "Expect early starts to beat the heat, stories behind the mosaics, and a relaxed lunch in Ksamil afterwards."),
         base_city="Sarandë", languages=["English", "Albanian", "Greek"],
         specialties=["History", "Archaeology", "UNESCO"], regions=["saranda", "inland-south"],
         signature_stops=["butrint", "ksamil", "gjirokaster"], years_experience=12,
         price_half_day=90, price_full_day=160, max_group=12, has_vehicle=False, licensed=True),
    dict(slug="elira-food", name="Elira M.", palette="terracotta",
         headline="Food, wine & village kitchens of the south",
         bio=("Elira runs tasting walks through Sarandë's markets and takes small groups to family wineries in Mesopotam. "
              "Byrek at dawn, grilled fish at sunset, and raki toasts in between — vegetarian-friendly on request."),
         base_city="Sarandë", languages=["English", "Albanian", "Italian"],
         specialties=["Food", "Wine", "Culture"], regions=["saranda"],
         signature_stops=["sarande", "mesopotam", "lekures-castle"], years_experience=7,
         price_half_day=70, price_full_day=130, max_group=8, has_vehicle=True, licensed=True),
    dict(slug="dritan-boat", name="Captain Dritan", palette="sea",
         headline="Private boat days to Kakome, Krorëz & hidden bays",
         bio=("A local skipper who has fished this coast for two decades. Dritan plans the route around the day's wind "
              "and swell, stops at 2–3 swim bays and knows the quietest coves for lunch."),
         base_city="Sarandë", languages=["English", "Albanian"],
         specialties=["Boat", "Snorkelling", "Beaches"], regions=["saranda", "riviera"],
         signature_stops=["kakome", "kroreza", "ksamil"], years_experience=20,
         price_half_day=220, price_full_day=420, max_group=10, has_vehicle=False, licensed=True),
    dict(slug="klea-riviera", name="Klea H.", palette="sunset",
         headline="Riviera road trips: villages, castles and viewpoints",
         bio=("Klea drives the coastal road from Sarandë to Llogara, timing Porto Palermo, Qeparo and Borsh around the "
              "light and the crowds. Ideal if you'd rather not drive the switchbacks yourself."),
         base_city="Himarë", languages=["English", "Albanian", "German"],
         specialties=["Road trips", "Photography", "Villages"], regions=["riviera", "saranda"],
         signature_stops=["porto-palermo", "qeparo", "borsh", "llogara"], years_experience=9,
         price_half_day=110, price_full_day=200, max_group=7, has_vehicle=True, licensed=True),
    dict(slug="gent-hiking", name="Gent B.", palette="olive",
         headline="Hikes to Gjipe canyon, Lëkurësi and the Llogara ridges",
         bio=("Mountain guide and first-aider. Gent's routes range from a sunset walk to Lëkurësi Castle to a full "
              "day down Gjipe canyon to its bay. Good boots, water and a swimsuit required."),
         base_city="Dhërmi", languages=["English", "Albanian", "French"],
         specialties=["Hiking", "Adventure", "Nature"], regions=["riviera", "north"],
         signature_stops=["gjipe", "llogara", "theth"], years_experience=11,
         price_half_day=80, price_full_day=140, max_group=10, has_vehicle=False, licensed=True),
    dict(slug="mirela-heritage", name="Mirela S.", palette="spring",
         headline="Gjirokastër stone city & the Blue Eye in one day",
         bio=("Born in Gjirokastër, Mirela pairs the Blue Eye in the cool morning with the castle and Old Bazaar in the "
              "afternoon — plus the best qifqi in town for lunch."),
         base_city="Gjirokastër", languages=["English", "Albanian", "Italian", "Greek"],
         specialties=["History", "Culture", "Food"], regions=["inland-south", "saranda"],
         signature_stops=["blue-eye", "gjirokaster"], years_experience=14,
         price_half_day=85, price_full_day=150, max_group=14, has_vehicle=True, licensed=True),
    dict(slug="ardit-family", name="Ardit & Sara", palette="lagoon",
         headline="Family-friendly days with kids in mind",
         bio=("A husband-and-wife team who plan gentle days with shade, snacks and swim stops — Butrint as a treasure "
              "hunt, pedal boats in Ksamil, and early finishes."),
         base_city="Ksamil", languages=["English", "Albanian", "Spanish"],
         specialties=["Family", "Beaches", "History"], regions=["saranda"],
         signature_stops=["ksamil", "butrint", "blue-eye"], years_experience=6,
         price_half_day=75, price_full_day=135, max_group=9, has_vehicle=True, licensed=False),
    dict(slug="besnik-grand-tour", name="Besnik T.", palette="aegean",
         headline="Multi-day private driver-guide, Tirana to Sarandë",
         bio=("Besnik handles airport pickups and the long drives — Tirana, Berat, Gjirokastër and the south — so you can "
              "enjoy the scenery. Comfortable minivan, flexible stops, bilingual commentary."),
         base_city="Tirana", languages=["English", "Albanian", "Italian", "German"],
         specialties=["Road trips", "History", "Multi-day"], regions=["capital", "central", "inland-south", "saranda"],
         signature_stops=["tirana", "berat", "gjirokaster", "sarande"], years_experience=16,
         price_half_day=120, price_full_day=220, max_group=7, has_vehicle=True, licensed=True),
]


def seed_guides():
    db.session.add_all([Guide(**g, is_sample=True, rating=None, review_count=0) for g in GUIDES])
    db.session.commit()


def undo_guides():
    truncate("guides")
