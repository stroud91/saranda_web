"use client";
import TourDetail from './TourDetail';

const tours = [
  {
    id: 1,
    name: 'Explore the Albanian Riviera',
    image: '/images/albanian-riviera.jpg',
    price: 350,
    duration: 5,
    description: 'A breathtaking tour of the Albanian Riviera, including beautiful beaches and cultural sites.'
  },
  {
    id: 2,
    name: 'Historical Sites of Gjirokaster',
    image: '/images/gjirokaster.jpg',
    price: 250,
    duration: 3,
    description: 'Discover the rich history of Gjirokaster, a UNESCO World Heritage Site.'
  }
];

const TourDetailPage = ({ params }) => {
  const tour = tours.find((tour) => tour.id === parseInt(params.id));

  if (!tour) {
    return <div>Tour not found</div>;
  }

  return <TourDetail tour={tour} />;
};

export default TourDetailPage;
