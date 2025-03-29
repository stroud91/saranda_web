import React from 'react';
import './TourDetail.css'; 

export default function TourDetail({ tour }) {
  if (!tour) {
    return <div>Tour not found.</div>;
  }

  return (
    <div className="tourDetail">
      <h1>{tour.tour_name}</h1>
      <p>Description: {tour.description}</p>
      <p>Price: ${tour.price}</p>
      <p>Start: {tour.start_date}</p>
      <p>End: {tour.end_date}</p>
      <p>Location: {tour.location}</p>
      <p>Available: {tour.is_available ? 'Yes' : 'No'}</p>
    </div>
  );
}