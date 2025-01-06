"use client";
// import styles from './HotelDetail.module.css';
import Image from 'next/image';

const HotelDetail = ({ hotel }) => {
  return (
    <div className={styles.hotelDetail}>
      <Image 
        src={hotel.image} 
        alt={hotel.name} 
        className={styles.hotelImage} 
        width={600} 
        height={400} 
      />
      <div className={styles.detailContent}>
        <h1>{hotel.name}</h1>
        <p>{hotel.description}</p>
        <p>Price per night: ${hotel.pricePerNight}</p>
        <p>Location: {hotel.location}</p>
        <button className={styles.bookButton}>Book Now</button>
      </div>
    </div>
  );
};

export default HotelDetail;