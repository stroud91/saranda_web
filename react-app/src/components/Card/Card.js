import React from 'react';
import './Card.css';

const Card = ({ title, description, image }) => {
  return (
    <div className="polaroid-card">
      <img src={image} alt={title} className="polaroid-image" />
      <div className="polaroid-content">
        <h2 className="polaroid-title">{title}</h2>
        <p className="polaroid-description">{description}</p>
      </div>
    </div>
  );
};

export default Card;
