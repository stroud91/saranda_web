import React, { useEffect } from 'react';
import Card from '../Card/Card.js';
import './Page.css';

const Dine = () => {
  const cardsData = [
    { title: 'Restaurant 1', description: 'Description 1', image: 'https://placekitten.com/300/200' },
    { title: 'Restaurant 2', description: 'Description 2', image: 'https://placekitten.com/301/200' },
    { title: 'Restaurant 3', description: 'Description 3', image: 'https://placekitten.com/302/200' },
    { title: 'Restaurant 4', description: 'Description 4', image: 'https://placekitten.com/303/200' },
    { title: 'Restaurant 5', description: 'Description 5', image: 'https://placekitten.com/304/200' },
    { title: 'Restaurant 6', description: 'Description 6', image: 'https://placekitten.com/305/200' },
  ];

  useEffect(() => {
    console.log(cardsData); 
    const handleScroll = () => {
      const cards = document.querySelectorAll('.polaroid-card');
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
      <h1>Dine</h1>
      <div className="card-container">
        {cardsData.map((card, index) => (
          <Card key={index} title={card.title} description={card.description} image={card.image} />
        ))}
      </div>
    </div>
  );
};

export default Dine;
