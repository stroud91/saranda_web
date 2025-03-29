import React from 'react';
import TourCard from './TourCard';
import './TourList.css'; 

export default function TourList({ tours }) {
  if (!tours || tours.length === 0) {
    return <div>No tours available.</div>;
  }

  return (
    <div className="tourList">
      {tours.map((tour) => (
        <TourCard key={tour.id} tour={tour} />
      ))}
    </div>
  );
}