import React from 'react';
import HotelCard from './HotelCard';
import styles from './HotelList.module.css';

export default function HotelList({ hotels }) {
  if (!hotels || hotels.length === 0) {
    return <div>No hotels available.</div>;
  }

  return (
    <div className={styles.hotelList}>
      {hotels.map((hotel) => (
        <HotelCard key={hotel.id} hotel={hotel} />
      ))}
    </div>
  );
}
