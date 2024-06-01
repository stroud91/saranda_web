import React, { useEffect } from 'react';
import Card from '../Card/Card';
import './Page.css';

const Activities = () => {
  const cardsData = [
    { title: 'Restaurant 1', description: 'Description 1', image: '/path-to-image1.jpg' },
    { title: 'Restaurant 2', description: 'Description 2', image: '/path-to-image2.jpg' },
    { title: 'Restaurant 3', description: 'Description 3', image: '/path-to-image3.jpg' },
    { title: 'Restaurant 4', description: 'Description 4', image: '/path-to-image1.jpg' },
    { title: 'Restaurant 5', description: 'Description 5', image: '/path-to-image2.jpg' },
    { title: 'Restaurant 6', description: 'Description 6', image: '/path-to-image3.jpg' },
  ];

  useEffect(() => {
    const handleScroll = () => {
      const cards = document.querySelectorAll('.card');
      const triggerBottom = window.innerHeight / 5 * 4;
      cards.forEach(card => {
        const cardTop = card.getBoundingClientRect().top;
        if (cardTop < triggerBottom) {
          card.classList.add('show');
        } else {
          card.classList.remove('show');
        }
      });
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className="page">
      <h1>Activities</h1>
      <div className="card-container">
        {cardsData.map((card, index) => (
          <Card key={index} title={card.title} description={card.description} image={card.image} />
        ))}
      </div>
    </div>
  );
};

export default Activities;
