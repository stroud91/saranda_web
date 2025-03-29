import React from 'react';
import HotelCard from './HotelCard';
import './HotelList.css';

export default function HotelList({ hotels }) {
  if (!hotels || hotels.length === 0) {
    return <div>No hotels available.</div>;
  }
  return (
    <div className="hotelList">
      {hotels.map((hotel) => (
        <HotelCard key={hotel.id} hotel={hotel} />
      ))}
    </div>
  );
}