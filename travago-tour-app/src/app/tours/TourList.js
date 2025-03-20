"use client";
import TourCard from './TourCard';
import styles from './TourList.module.css';

const TourList = ({ tours }) => {
  return (
    <div className={styles.tourList}>
      {tours.map((tour) => (
        <TourCard key={tour.id} tour={tour} />
      ))}
    </div>
  );
};

export default TourList;
