import React from 'react';
import './HotelDetail.css';

export default function HotelDetail({ hotel }) {
  if (!hotel) {
    return <div>Hotel not found.</div>;
  }
  return (
    <div className="hotelDetail">
      <h1>{hotel.hotel_name}</h1>
      <p>Address: {hotel.address}</p>
      <p>Price/Night: ${hotel.price_per_night}</p>
      <p>Total Rooms: {hotel.total_rooms}</p>
      <p>Available Rooms: {hotel.available_rooms}</p>
      <p>City: {hotel.city}</p>
      <p>Contact: {hotel.contact_email || 'N/A'}</p>
    </div>
  );
}