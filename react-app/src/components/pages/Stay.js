import React, { useEffect } from 'react';
import Card from '../Card/Card';
import './Page.css';

const Stay = () => {
  const cardsData = [
    {
      title: 'Restaurant 1',
      description: 'Description 1',
      image: 'https://placekitten.com/300/200',
      detailedInfo: {
        images: ['https://placekitten.com/300/200', 'https://placekitten.com/301/200', 'https://placekitten.com/302/200'],
        additionalInfo: 'Detailed description about Restaurant 1 including its specialty dishes, ambiance, and location.'
      }
    },
    {
      title: 'Restaurant 2',
      description: 'Description 2',
      image: 'https://placekitten.com/301/200',
      detailedInfo: {
        images: ['https://placekitten.com/301/200', 'https://placekitten.com/302/200', 'https://placekitten.com/303/200'],
        additionalInfo: 'Detailed description about Restaurant 2 including its specialty dishes, ambiance, and location.'
      }
    },
    {
      title: 'Restaurant 3',
      description: 'Description 3',
      image: 'https://placekitten.com/302/200',
      detailedInfo: {
        images: ['https://placekitten.com/302/200', 'https://placekitten.com/303/200', 'https://placekitten.com/304/200'],
        additionalInfo: 'Detailed description about Restaurant 3 including its specialty dishes, ambiance, and location.'
      }
    },
    {
      title: 'Hotel 1',
      description: 'Description 1',
      image: 'https://placekitten.com/303/200',
      detailedInfo: {
        images: ['https://placekitten.com/303/200', 'https://placekitten.com/304/200', 'https://placekitten.com/305/200'],
        additionalInfo: 'Detailed description about Hotel 1 including its amenities, room types, and location.'
      }
    },
    {
      title: 'Hotel 2',
      description: 'Description 2',
      image: 'https://placekitten.com/304/200',
      detailedInfo: {
        images: ['https://placekitten.com/304/200', 'https://placekitten.com/305/200', 'https://placekitten.com/306/200'],
        additionalInfo: 'Detailed description about Hotel 2 including its amenities, room types, and location.'
      }
    },
    {
      title: 'Hotel 3',
      description: 'Description 3',
      image: 'https://placekitten.com/305/200',
      detailedInfo: {
        images: ['https://placekitten.com/305/200', 'https://placekitten.com/306/200', 'https://placekitten.com/307/200'],
        additionalInfo: 'Detailed description about Hotel 3 including its amenities, room types, and location.'
      }
    },
    {
      title: 'Activity 1',
      description: 'Description 1',
      image: 'https://placekitten.com/306/200',
      detailedInfo: {
        images: ['https://placekitten.com/306/200', 'https://placekitten.com/307/200', 'https://placekitten.com/308/200'],
        additionalInfo: 'Detailed description about Activity 1 including its highlights, duration, and location.'
      }
    },
    {
      title: 'Activity 2',
      description: 'Description 2',
      image: 'https://placekitten.com/307/200',
      detailedInfo: {
        images: ['https://placekitten.com/307/200', 'https://placekitten.com/308/200', 'https://placekitten.com/309/200'],
        additionalInfo: 'Detailed description about Activity 2 including its highlights, duration, and location.'
      }
    },
    {
      title: 'Activity 3',
      description: 'Description 3',
      image: 'https://placekitten.com/308/200',
      detailedInfo: {
        images: ['https://placekitten.com/308/200', 'https://placekitten.com/309/200', 'https://placekitten.com/310/200'],
        additionalInfo: 'Detailed description about Activity 3 including its highlights, duration, and location.'
      }
    }
  ];

  useEffect(() => {
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
      <h1>Stay</h1>
      <div className="card-container">
        {cardsData.map((card, index) => (
          <Card key={index} title={card.title} description={card.description} image={card.image} detailedInfo={card.detailedInfo} />
        ))}
      </div>
    </div>
  );
};

export default Stay;
