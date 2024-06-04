import React, { useState } from 'react';
import './PersonalizedTrip.css';

const PersonalizedTrip = () => {
  const [selectedItems, setSelectedItems] = useState([]);

  return (
    <div className="personalized-trip-page">
      <h1>Your Personalized Trip</h1>
      <div className="trip-container">
        {selectedItems.length > 0 ? (
          selectedItems.map((item, index) => (
            <div key={index} className="trip-item">
              <h2>{item.title}</h2>
              <p>{item.description}</p>
              <img src={item.image} alt={item.title} />
            </div>
          ))
        ) : (
          <p>No items selected yet.</p>
        )}
      </div>
      <button className="confirm-button">Confirm Trip</button>
    </div>
  );
};

export default PersonalizedTrip;
