import React from 'react';
import Link from 'next/link';
import styles from './TourCard.module.css';

/**
 * Displays brief info about a tour plus a link to its detail page.
 * @param {Object} tour - The tour object.
 */
export default function TourCard({ tour }) {
  return (
    <div className={styles.card}>
      <h2>{tour.tour_name}</h2>
      <p>{tour.description}</p>
      <p>Price: ${tour.price}</p>
      <Link href={`/tours/${tour.id}`}>View Details</Link>
    </div>
  );
}