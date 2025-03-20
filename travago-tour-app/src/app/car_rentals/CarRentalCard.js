"use client";
import styles from './CarRentalCard.module.css';
import Image from 'next/image';
import Link from 'next/link';

const CarRentalCard = ({ car }) => {
  return (
    <div className={styles.carRentalCard}>
      <Image 
        src={car.image} 
        alt={car.model} 
        className={styles.carImage} 
        width={300} 
        height={200} 
      />
      <div className={styles.cardContent}>
        <h3>{car.model}</h3>
        <p>Price per day: ${car.pricePerDay}</p>
        <Link href={`/car-rentals/${car.id}`} className={styles.detailsLink}>Rent Now</Link>
      </div>
    </div>
  );
};

export default CarRentalCard;