import React from 'react';
import { Link } from 'react-router-dom';
import './CarRentalCard.css'; 

export default function CarRentalCard({ rental }) {
  return (
    <div className="rentalCard">
      <h2>{rental.car_model}</h2>
      <p>Type: {rental.car_type}</p>
      <p>Price/Day: ${rental.price_per_day}</p>
      <p>Status: {rental.availability_status}</p>
      <p>Company: {rental.rental_company}</p>
      <p>Location: {rental.location}</p>
      <Link to={`/carRentals/${rental.id}`}>View Details</Link>
    </div>
  );
}