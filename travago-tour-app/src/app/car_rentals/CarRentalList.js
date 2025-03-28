import React from 'react';
import CarRentalCard from './CarRentalCard';
import styles from './CarRentalList.module.css';

/**
 * Renders a list of car rentals using the CarRentalCard component.
 * @param {Object[]} rentals - Array of car rental objects.
 */
export default function CarRentalList({ rentals }) {
  if (!rentals || rentals.length === 0) {
    return <div>No car rentals available.</div>;
  }

  return (
    <div className={styles.rentalList}>
      {rentals.map((rental) => (
        <CarRentalCard key={rental.id} rental={rental} />
      ))}
    </div>
  );
}