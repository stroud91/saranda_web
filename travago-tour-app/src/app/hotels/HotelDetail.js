import React from 'react';
import styles from './HotelDetail.module.css';

export default function HotelDetail({ hotel }) {
  if (!hotel) {
    return <div>Hotel not found.</div>;
  }

  return (
    <div className={styles.detail}>
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