import React from 'react';
import Link from 'next/link';
import styles from './HotelCard.module.css';

export default function HotelCard({ hotel }) {
  return (
    <div className={styles.card}>
      <h2>{hotel.hotel_name}</h2>
      <p>{hotel.address}</p>
      <p>Price per night: ${hotel.price_per_night}</p>
      <p>City: {hotel.city}</p>
      <Link href={`/hotels/${hotel.id}`}>View Details</Link>
    </div>
  );
}