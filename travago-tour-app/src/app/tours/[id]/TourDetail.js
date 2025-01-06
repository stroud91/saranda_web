"use client";
// import styles from './TourDetail.module.css';
import Image from 'next/image';

const TourDetail = ({ tour }) => {
  return (
    <div className={styles.tourDetail}>
      <Image 
        src={tour.image} 
        alt={tour.name} 
        className={styles.tourImage} 
        width={600} 
        height={400} 
      />
      <div className={styles.detailContent}>
        <h1>{tour.name}</h1>
        <p>{tour.description}</p>
        <p>Price: ${tour.price}</p>
        <p>Duration: {tour.duration} days</p>
        <button className={styles.bookButton}>Book Tour</button>
      </div>
    </div>
  );
};

export default TourDetail;