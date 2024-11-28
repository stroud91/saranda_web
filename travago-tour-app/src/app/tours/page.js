"use client";
import TourList from './TourList';

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

const TourPage = () => {
  return <TourList tours={tours} />;
};

export default TourPage;
