"use client";
import styles from './HotelCard.module.css';
import Image from 'next/image';
import Link from 'next/link';

const HotelCard = ({ hotel }) => {
  return (
    <div className={styles.hotelCard}>
      <Image src={hotel.image} alt={hotel.name} className={styles.hotelImage} />
      <div className={styles.cardContent}>
        <h3>{hotel.name}</h3>
        <p>Price per night: ${hotel.pricePerNight}</p>
        <Link href={`/hotels/${hotel.id}`} className={styles.detailsLink}>Book Now</Link>
      </div>
    </div>
  );
};

export default HotelCard;