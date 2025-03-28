import React from 'react';
import TourCard from './TourCard';
import styles from './TourList.module.css';

/**
 * Renders a list of tours using the TourCard component.
 * @param {Object[]} tours - Array of tour objects.
 */
export default function TourList({ tours }) {
  if (!tours || tours.length === 0) {
    return <div>No tours available.</div>;
  }

  return (
    <div className={styles.tourList}>
      {tours.map((tour) => (
        <TourCard key={tour.id} tour={tour} />
      ))}
    </div>
  );
}