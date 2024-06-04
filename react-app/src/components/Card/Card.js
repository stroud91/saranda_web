import React, { useState } from 'react';
import { useModal } from '../../context/Modal';
import './Card.css';
import Datetime from 'react-datetime';
import 'react-datetime/css/react-datetime.css';

const Card = ({ title, description, image, detailedInfo }) => {
  const { setModalContent } = useModal();
  const [startDate, setStartDate] = useState(new Date());
  const [endDate, setEndDate] = useState(new Date());

  const openModal = () => {
    setModalContent(
      <div className="modal-content">
        <div className="modal-carousel">
          {detailedInfo.images.map((img, index) => (
            <div key={index}>
              <img src={img} alt={`${title} ${index + 1}`} />
            </div>
          ))}
        </div>
        <h2>{title}</h2>
        <p>{detailedInfo.additionalInfo}</p>
        <div className="date-time-picker">
          <label>Select Start Time & Date:</label>
          <Datetime
            value={startDate}
            onChange={(date) => setStartDate(date)}
            inputProps={{ className: 'date-picker' }}
          />
        </div>
        <div className="date-time-picker">
          <label>Select End Time & Date:</label>
          <Datetime
            value={endDate}
            onChange={(date) => setEndDate(date)}
            inputProps={{ className: 'date-picker' }}
          />
        </div>
        <button className="select-time-btn">Confirm Selection</button>
      </div>
    );
  };

  return (
    <div className="polaroid-card" onClick={openModal}>
      <img src={image} alt={title} className="polaroid-image" />
      <div className="polaroid-content">
        <h2 className="polaroid-title">{title}</h2>
        <p className="polaroid-description">{description}</p>
      </div>
    </div>
  );
};

export default Card;
