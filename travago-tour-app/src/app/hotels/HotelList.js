"use client";
import HotelCard from './HotelCard';
// import styles from './HotelList.module.css';

const HotelList = ({ hotels }) => {
  return (
    <div className={styles.hotelList}>
      {hotels.map((hotel) => (
        <HotelCard key={hotel.id} hotel={hotel} />
      ))}
    </div>
  );
};

export default HotelList;