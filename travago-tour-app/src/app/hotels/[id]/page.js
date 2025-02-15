"use client";
import HotelDetail from './HotelDetail';

const hotels = [
  {
    id: 1,
    name: 'Seaside Hotel',
    image: '/images/seaside-hotel.jpg',
    pricePerNight: 120,
    description: 'A beautiful seaside hotel with stunning views.',
    location: 'Saranda, Albania'
  },
  {
    id: 2,
    name: 'Mountain Retreat',
    image: '/images/mountain-retreat.jpg',
    pricePerNight: 150,
    description: 'A peaceful mountain retreat perfect for relaxation.',
    location: 'Gjirokaster, Albania'
  }
];

const HotelDetailPage = ({ params }) => {
  const hotel = hotels.find((hotel) => hotel.id === parseInt(params.id));

  if (!hotel) {
    return <div>Hotel not found</div>;
  }

  return <HotelDetail hotel={hotel} />;
};

export default HotelDetailPage;
