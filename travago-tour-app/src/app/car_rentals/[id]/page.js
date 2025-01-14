"use client";
import CarRentalDetail from './CarRentalDetail';

const cars = [
  {
    id: 1,
    model: 'Toyota Corolla',
    image: '/images/toyota-corolla.jpg',
    pricePerDay: 45,
    description: 'A reliable and fuel-efficient compact car, perfect for city driving and longer trips.'
  },
  {
    id: 2,
    model: 'Jeep Wrangler',
    image: '/images/jeep-wrangler.jpg',
    pricePerDay: 90,
    description: 'A rugged SUV ideal for off-road adventures and exploring the countryside.'
  }
];

const CarRentalDetailPage = ({ params }) => {
  const car = cars.find((car) => car.id === parseInt(params.id));

  if (!car) {
    return <div>Car not found</div>;
  }

  return <CarRentalDetail car={car} />;
};

export default CarRentalDetailPage;
