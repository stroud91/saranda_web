"use client";
import styles from './TourCard.module.css';
import Image from 'next/image';
import Link from 'next/link';
import { FaMapMarkerAlt } from 'react-icons/fa';

const TourCard = ({ tour }) => {
  return (
    <div className={styles.tourCard}>
      <Image src={tour.image} alt={tour.name} className={styles.tourImage} />
      <div className={styles.cardContent}>
        <h3>{tour.name}</h3>
        <p><FaMapMarkerAlt /> {tour.location}</p>
        <p>Price: ${tour.price}</p>
        <Link href={`/tours/${tour.id}`} className={styles.detailsLink}>Explore More</Link>
      </div>
    </div>
  );
};

export default TourCard;