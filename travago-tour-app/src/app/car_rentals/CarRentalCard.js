import React from 'react';
import Link from 'next/link';
import styles from './CarRentalCard.module.css';

/**
 * Displays brief info about a car rental with a link to its detail page.
 * @param {Object} rental - The car rental object.
 */
export default function CarRentalCard({ rental }) {
  return (
    <div className={styles.card}>
      <h2>{rental.car_model}</h2>
      <p>Type: {rental.car_type}</p>
      <p>Price/Day: ${rental.price_per_day}</p>
      <p>Status: {rental.availability_status}</p>
      <p>Company: {rental.rental_company}</p>
      <p>Location: {rental.location}</p>
      <Link href={`/carRentals/${rental.id}`}>View Details</Link>
    </div>
  );
}