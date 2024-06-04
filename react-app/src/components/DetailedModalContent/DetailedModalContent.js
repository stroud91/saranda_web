import React from 'react';
import { Carousel } from 'react-responsive-carousel';
import 'react-responsive-carousel/lib/styles/carousel.min.css';
import './DetailedModalContent.css';

const DetailedModalContent = ({ title, description, detailedInfo, closeModal }) => {
  return (
    <div className="detailed-modal-content">
      <button className="close-button" onClick={closeModal}>Close</button>
      <Carousel showThumbs={false} infiniteLoop useKeyboardArrows>
        {detailedInfo.images.map((image, index) => (
          <div key={index}>
            <img src={image} alt={`Slide ${index + 1}`} />
          </div>
        ))}
      </Carousel>
      <div className="modal-description">
        <h2>{title}</h2>
        <p>{description}</p>
        <p>{detailedInfo.additionalInfo}</p>
        <button className="modal-button">Select Time & Date</button>
      </div>
    </div>
  );
};

export default DetailedModalContent;
