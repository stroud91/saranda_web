from app.models import db, CarRental, environment, SCHEMA
from sqlalchemy.sql import text
from datetime import datetime


def seed_car_rentals():
    car_1 = CarRental(
        car_model='Toyota Corolla',
        car_type='Sedan',
        price_per_day=40.00,
        availability_status='available',
        rental_company='Saranda Car Rentals',
        location='Saranda, Albania'
    )

    car_2 = CarRental(
        car_model='Hyundai Tucson',
        car_type='SUV',
        price_per_day=70.00,
        availability_status='available',
        rental_company='Saranda Car Rentals',
        location='Saranda, Albania'
    )

    car_3 = CarRental(
        car_model='Volkswagen Golf',
        car_type='Hatchback',
        price_per_day=50.00,
        availability_status='available',
        rental_company='Albanian Auto',
        location='Saranda, Albania'
    )

    car_4 = CarRental(
        car_model='Jeep Wrangler',
        car_type='SUV',
        price_per_day=90.00,
        availability_status='available',
        rental_company='Riviera Car Hire',
        location='Saranda, Albania'
    )

    car_5 = CarRental(
        car_model='Mercedes-Benz C-Class',
        car_type='Sedan',
        price_per_day=120.00,
        availability_status='available',
        rental_company='Luxury Wheels Saranda',
        location='Saranda, Albania'
    )

    car_6 = CarRental(
        car_model='Fiat Panda',
        car_type='Hatchback',
        price_per_day=35.00,
        availability_status='available',
        rental_company='Saranda Budget Rentals',
        location='Saranda, Albania'
    )

    car_7 = CarRental(
        car_model='Nissan Qashqai',
        car_type='SUV',
        price_per_day=65.00,
        availability_status='available',
        rental_company='Albanian Auto',
        location='Saranda, Albania'
    )

    car_8 = CarRental(
        car_model='Ford Fiesta',
        car_type='Hatchback',
        price_per_day=45.00,
        availability_status='available',
        rental_company='Riviera Car Hire',
        location='Saranda, Albania'
    )

    car_9 = CarRental(
        car_model='BMW X5',
        car_type='SUV',
        price_per_day=150.00,
        availability_status='available',
        rental_company='Luxury Wheels Saranda',
        location='Saranda, Albania'
    )

    car_10 = CarRental(
        car_model='Audi A3',
        car_type='Sedan',
        price_per_day=85.00,
        availability_status='available',
        rental_company='Saranda Car Rentals',
        location='Saranda, Albania'
    )

    car_11 = CarRental(
        car_model='Renault Clio',
        car_type='Hatchback',
        price_per_day=40.00,
        availability_status='available',
        rental_company='Saranda Budget Rentals',
        location='Saranda, Albania'
    )

    car_12 = CarRental(
        car_model='Skoda Octavia',
        car_type='Sedan',
        price_per_day=55.00,
        availability_status='available',
        rental_company='Albanian Auto',
        location='Saranda, Albania'
    )

    car_13 = CarRental(
        car_model='Land Rover Defender',
        car_type='SUV',
        price_per_day=180.00,
        availability_status='available',
        rental_company='Riviera Car Hire',
        location='Saranda, Albania'
    )

    car_14 = CarRental(
        car_model='Peugeot 208',
        car_type='Hatchback',
        price_per_day=38.00,
        availability_status='available',
        rental_company='Saranda Car Rentals',
        location='Saranda, Albania'
    )

    car_15 = CarRental(
        car_model='Toyota RAV4',
        car_type='SUV',
        price_per_day=75.00,
        availability_status='available',
        rental_company='Albanian Auto',
        location='Saranda, Albania'
    )

    car_16 = CarRental(
        car_model='Chevrolet Spark',
        car_type='Hatchback',
        price_per_day=33.00,
        availability_status='available',
        rental_company='Saranda Budget Rentals',
        location='Saranda, Albania'
    )

    car_17 = CarRental(
        car_model='Volvo XC90',
        car_type='SUV',
        price_per_day=140.00,
        availability_status='available',
        rental_company='Luxury Wheels Saranda',
        location='Saranda, Albania'
    )

    car_18 = CarRental(
        car_model='Mazda CX-5',
        car_type='SUV',
        price_per_day=68.00,
        availability_status='available',
        rental_company='Riviera Car Hire',
        location='Saranda, Albania'
    )

    car_19 = CarRental(
        car_model='Opel Astra',
        car_type='Hatchback',
        price_per_day=42.00,
        availability_status='available',
        rental_company='Saranda Car Rentals',
        location='Saranda, Albania'
    )

    car_20 = CarRental(
        car_model='Suzuki Jimny',
        car_type='SUV',
        price_per_day=55.00,
        availability_status='available',
        rental_company='Albanian Auto',
        location='Saranda, Albania'
    )

    car_21 = CarRental(
        car_model='Honda CR-V',
        car_type='SUV',
        price_per_day=72.00,
        availability_status='available',
        rental_company='Riviera Car Hire',
        location='Saranda, Albania'
    )

    car_22 = CarRental(
        car_model='Mercedes-Benz GLE',
        car_type='SUV',
        price_per_day=160.00,
        availability_status='available',
        rental_company='Luxury Wheels Saranda',
        location='Saranda, Albania'
    )

    car_23 = CarRental(
        car_model='Ford Focus',
        car_type='Sedan',
        price_per_day=50.00,
        availability_status='available',
        rental_company='Saranda Budget Rentals',
        location='Saranda, Albania'
    )

    car_24 = CarRental(
        car_model='Hyundai i20',
        car_type='Hatchback',
        price_per_day=37.00,
        availability_status='available',
        rental_company='Saranda Car Rentals',
        location='Saranda, Albania'
    )

    car_25 = CarRental(
        car_model='Audi Q7',
        car_type='SUV',
        price_per_day=180.00,
        availability_status='available',
        rental_company='Luxury Wheels Saranda',
        location='Saranda, Albania'
    )

    db.session.add_all([
        car_1, car_2, car_3, car_4, car_5, car_6, car_7, car_8, car_9, car_10,
        car_11, car_12, car_13, car_14, car_15, car_16, car_17, car_18, car_19, car_20,
        car_21, car_22, car_23, car_24, car_25
    ])
    db.session.commit()

# Uses a raw SQL query to TRUNCATE or DELETE the car_rentals table
def undo_car_rentals():
    if environment == "production":
        db.session.execute(f"TRUNCATE table {SCHEMA}.car_rentals RESTART IDENTITY CASCADE;")
    else:
        db.session.execute(text("DELETE FROM car_rentals"))
    
    db.session.commit()
