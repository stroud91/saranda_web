"use client";
import styles from './TourCard.module.css';
import Image from 'next/image';
import Link from 'next/link';

const TourCard = ({ tour }) => {
  return (
    <div className={styles.tourCard}>
      <Image 
        src={tour.image} 
        alt={tour.name} 
        className={styles.tourImage} 
        width={300} 
        height={200} 
      />
      <div className={styles.cardContent}>
        <h3>{tour.name}</h3>
        <p>Price: ${tour.price}</p>
        <p>{tour.duration} days</p>
        <Link href={`/tours/${tour.id}`} className={styles.detailsLink}>View Tour</Link>
      </div>
    </div>
  );
};

export default TourCard;