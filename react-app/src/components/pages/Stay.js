import React, { useEffect } from 'react';
import Card from '../Card/Card';
import './Page.css';

const Stay = () => {
  const cardsData = [
    { title: 'Hotel 1', description: 'Description 1', image: '/path-to-image1.jpg' },
    { title: 'Hotel 2', description: 'Description 2', image: '/path-to-image2.jpg' },
    // Add more cards as needed
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
      <h1>Stay</h1>
      {cardsData.map((card, index) => (
        <Card key={index} title={card.title} description={card.description} image={card.image} />
      ))}
    </div>
  );
};

export default Stay;
