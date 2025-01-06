"use client";
// import styles from './CarRentalDetail.module.css';
import Image from 'next/image';

const CarRentalDetail = ({ car }) => {
  return (
    <div className={styles.carRentalDetail}>
      <Image 
        src={car.image} 
        alt={car.model} 
        className={styles.carImage} 
        width={600} 
        height={400} 
      />
      <div className={styles.detailContent}>
        <h1>{car.model}</h1>
        <p>{car.description}</p>
        <p>Price per day: ${car.pricePerDay}</p>
        <button className={styles.bookButton}>Book Now</button>
      </div>
    </div>
  );
};

export default CarRentalDetail;