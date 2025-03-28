import React from 'react';
import styles from './CarRentalDetail.module.css';

/**
 * Displays detailed information about a single car rental.
 * @param {Object} rental - The car rental object.
 */
export default function CarRentalDetail({ rental }) {
  if (!rental) {
    return <div>Car rental not found.</div>;
  }

  return (
    <div className={styles.detail}>
      <h1>{rental.car_model}</h1>
      <p>Type: {rental.car_type}</p>
      <p>Price/Day: ${rental.price_per_day}</p>
      <p>Status: {rental.availability_status}</p>
      <p>Company: {rental.rental_company}</p>
      <p>Location: {rental.location}</p>
    </div>
  );
}