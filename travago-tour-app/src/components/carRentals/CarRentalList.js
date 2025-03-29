import React from 'react';
import CarRentalCard from './CarRentalCard';
import './CarRentalList.css'; 

export default function CarRentalList({ rentals }) {
  if (!rentals || rentals.length === 0) {
    return <div>No car rentals available.</div>;
  }
  return (
    <div className="rentalList">
      {rentals.map((rental) => (
        <CarRentalCard key={rental.id} rental={rental} />
      ))}
    </div>
  );
}