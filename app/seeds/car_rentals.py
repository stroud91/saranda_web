from app.models import CarRental, db

from ._util import truncate

# Sample fleet — replace with your partner rental companies before launch.
CARS = [
    ('Toyota Corolla', 'Sedan', 40.0, 'Saranda Car Rentals', 'manual'),
    ('Hyundai Tucson', 'SUV', 70.0, 'Saranda Car Rentals', 'automatic'),
    ('Volkswagen Golf', 'Hatchback', 50.0, 'Albanian Auto', 'manual'),
    ('Jeep Wrangler', 'SUV', 90.0, 'Riviera Car Hire', 'automatic'),
    ('Mercedes-Benz C-Class', 'Sedan', 120.0, 'Luxury Wheels Saranda', 'automatic'),
    ('Fiat Panda', 'Hatchback', 35.0, 'Saranda Budget Rentals', 'manual'),
    ('Nissan Qashqai', 'SUV', 65.0, 'Albanian Auto', 'manual'),
    ('Ford Fiesta', 'Hatchback', 45.0, 'Riviera Car Hire', 'manual'),
    ('BMW X5', 'SUV', 150.0, 'Luxury Wheels Saranda', 'automatic'),
    ('Audi A3', 'Sedan', 85.0, 'Saranda Car Rentals', 'automatic'),
    ('Renault Clio', 'Hatchback', 40.0, 'Saranda Budget Rentals', 'manual'),
    ('Skoda Octavia', 'Sedan', 55.0, 'Albanian Auto', 'manual'),
    ('Land Rover Defender', 'SUV', 180.0, 'Riviera Car Hire', 'automatic'),
    ('Peugeot 208', 'Hatchback', 38.0, 'Saranda Car Rentals', 'manual'),
    ('Toyota RAV4', 'SUV', 75.0, 'Albanian Auto', 'automatic'),
    ('Chevrolet Spark', 'Hatchback', 33.0, 'Saranda Budget Rentals', 'manual'),
    ('Volvo XC90', 'SUV', 140.0, 'Luxury Wheels Saranda', 'automatic'),
    ('Mazda CX-5', 'SUV', 68.0, 'Riviera Car Hire', 'manual'),
    ('Opel Astra', 'Hatchback', 42.0, 'Saranda Car Rentals', 'manual'),
    ('Suzuki Jimny', 'SUV', 55.0, 'Albanian Auto', 'manual'),
    ('Honda CR-V', 'SUV', 72.0, 'Riviera Car Hire', 'automatic'),
    ('Mercedes-Benz GLE', 'SUV', 160.0, 'Luxury Wheels Saranda', 'automatic'),
    ('Ford Focus', 'Sedan', 50.0, 'Saranda Budget Rentals', 'manual'),
    ('Hyundai i20', 'Hatchback', 37.0, 'Saranda Car Rentals', 'manual'),
    ('Audi Q7', 'SUV', 180.0, 'Luxury Wheels Saranda', 'automatic'),
]


def seed_car_rentals():
    db.session.add_all([
        CarRental(car_model=m, car_type=t, price_per_day=p, rental_company=c, location="Sarandë, Albania",
                  availability_status="available", seats=7 if m in ("Volvo XC90", "Audi Q7") else 5, transmission=tr)
        for m, t, p, c, tr in CARS
    ])
    db.session.commit()


def undo_car_rentals():
    truncate("car_rentals")
