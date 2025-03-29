import React from 'react';
import { Link } from 'react-router-dom';
import './HotelCard.css';

export default function HotelCard({ hotel }) {
  return (
    <div className="hotelCard">
      <h2>{hotel.hotel_name}</h2>
      <p>{hotel.address}</p>
      <p>Price per night: ${hotel.price_per_night}</p>
      <p>City: {hotel.city}</p>
      <Link to={`/hotels/${hotel.id}`}>View Details</Link>
    </div>
  );
}