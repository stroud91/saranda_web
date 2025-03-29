import React from 'react';
import { Link } from 'react-router-dom';
import './TourCard.css';

export default function TourCard({ tour }) {
  return (
    <div className="tourCard">
      <h2>{tour.tour_name}</h2>
      <p>{tour.description}</p>
      <p>Price: ${tour.price}</p>
      <Link to={`/tours/${tour.id}`}>View Details</Link>
    </div>
  );
}