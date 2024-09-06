import React, { useEffect } from 'react';
import Card from '../Card/Card';
import './Page.css';

const Stay = () => {
  const cardsData = [
    {
      title: 'Santa Quaranta Premium Resort',
      description: 'A luxury 5-star resort with a private beach and incredible views of the Ionian Sea.',
      image: 'https://dynamic-media-cdn.tripadvisor.com/media/photo-o/0a/fa/78/bc/santa-quaranta-premium.jpg?w=1200&h=-1&s=1',
      detailedInfo: {
        images: [
          'https://media-cdn.tripadvisor.com/media/photo-s/18/63/21/8b/santa-quaranta.jpg',
          'https://media-cdn.tripadvisor.com/media/photo-o/18/63/21/9a/santa-quaranta-pool.jpg',
          'https://media-cdn.tripadvisor.com/media/photo-s/18/63/21/9b/santa-quaranta-sunset.jpg'
        ],
        additionalInfo: 'This resort offers a seasonal outdoor pool, sun terrace, and rooms with balconies overlooking the sea.'
      }
    },
    {
      title: 'Illyrian Boutique Hotel',
      description: 'A modern 4-star boutique hotel in the heart of Saranda with a rooftop cocktail bar.',
      image: 'https://dynamic-media-cdn.tripadvisor.com/media/photo-o/28/4f/cc/1b/illyrian-boutique-hotel.jpg?w=1100&h=-1&s=1',
      detailedInfo: {
        images: [
          'https://media-cdn.tripadvisor.com/media/photo-s/19/63/12/8f/illyrian-boutique.jpg',
          'https://media-cdn.tripadvisor.com/media/photo-o/19/63/12/9b/illyrian-boutique-lobby.jpg',
          'https://media-cdn.tripadvisor.com/media/photo-s/19/63/12/9c/illyrian-boutique-room.jpg'
        ],
        additionalInfo: 'Located near the beachfront promenade, it features a classy restaurant and modern, stylish rooms with balconies.'
      }
    },
    {
      title: 'Glow Boutique Hotel & Suites',
      description: 'A stylish 4-star hotel near Mango Beach with a pool and a sun deck with loungers.',
      image: 'https://dynamic-media-cdn.tripadvisor.com/media/photo-o/14/e5/22/23/p-20180912-155459-largejpg.jpg?w=1100&h=-1&s=1',
      detailedInfo: {
        images: [
          'https://media-cdn.tripadvisor.com/media/photo-s/19/63/14/7d/glow-boutique-hotel.jpg',
          'https://media-cdn.tripadvisor.com/media/photo-o/19/63/14/8e/glow-boutique-pool.jpg',
          'https://media-cdn.tripadvisor.com/media/photo-s/19/63/14/9f/glow-boutique-sunset.jpg'
        ],
        additionalInfo: 'This hotel offers a modern and comfortable stay with rooms equipped with balconies, offering stunning sea views.'
      }
    },
    {
      title: 'Hotel Butrinti',
      description: 'A 5-star hotel featuring a beautiful outdoor pool, spa, and fitness center.',
      image: 'https://dynamic-media-cdn.tripadvisor.com/media/photo-o/29/5d/63/9d/hotel-butrinti.jpg?w=1200&h=-1&s=1',
      detailedInfo: {
        images: [
          'https://media-cdn.tripadvisor.com/media/photo-s/19/63/15/9b/hotel-butrinti.jpg',
          'https://media-cdn.tripadvisor.com/media/photo-o/19/63/15/9c/hotel-butrinti-room.jpg',
          'https://media-cdn.tripadvisor.com/media/photo-s/19/63/15/9f/hotel-butrinti-spa.jpg'
        ],
        additionalInfo: 'Located near the beachfront promenade, the hotel offers luxurious rooms with sea views, as well as a spa and sauna.'
      }
    },
    {
      title: 'Mucobega Hotel',
      description: 'A beachfront hotel with private beach access and spacious rooms with ocean views.',
      image: 'https://dynamic-media-cdn.tripadvisor.com/media/photo-o/14/c7/0c/9b/mucobega-hotel.jpg?w=1200&h=-1&s=1',
      detailedInfo: {
        images: [
          'https://media-cdn.tripadvisor.com/media/photo-s/19/63/15/9d/mucobega-hotel.jpg',
          'https://media-cdn.tripadvisor.com/media/photo-o/19/63/15/9e/mucobega-hotel-beach.jpg',
          'https://media-cdn.tripadvisor.com/media/photo-s/19/63/15/9f/mucobega-hotel-sunset.jpg'
        ],
        additionalInfo: 'Mucobega Hotel offers a quiet retreat with a private beach, a pool, and great facilities for families.'
      }
    },
    {
      title: 'Sunset Suites',
      description: 'A beachfront hotel with spacious rooms and magical sunset views.',
      image: 'https://dynamic-media-cdn.tripadvisor.com/media/photo-o/13/fc/9e/28/sunset-suites.jpg?w=1200&h=-1&s=1',
      detailedInfo: {
        images: [
          'https://media-cdn.tripadvisor.com/media/photo-s/19/63/15/9e/sunset-suites.jpg',
          'https://media-cdn.tripadvisor.com/media/photo-o/19/63/15/9f/sunset-suites-room.jpg',
          'https://media-cdn.tripadvisor.com/media/photo-s/19/63/15/9d/sunset-suites-view.jpg'
        ],
        additionalInfo: 'This hotel offers a private beach area, bar, and restaurant, perfect for a relaxing stay near Saranda’s port.'
      }
    },
    {
      title: 'Hotel Apollon',
      description: 'An adults-only hotel with private beach access and stunning ocean views.',
      image: 'https://dynamic-media-cdn.tripadvisor.com/media/photo-o/1c/c9/06/5a/apollonion-asterias-resort.jpg?w=1100&h=-1&s=1',
      detailedInfo: {
        images: [
          'https://media-cdn.tripadvisor.com/media/photo-s/19/63/15/9c/hotel-apollon.jpg',
          'https://media-cdn.tripadvisor.com/media/photo-o/19/63/15/9e/hotel-apollon-beach.jpg',
          'https://media-cdn.tripadvisor.com/media/photo-s/19/63/15/9f/hotel-apollon-sunset.jpg'
        ],
        additionalInfo: 'Hotel Apollon is perfect for a romantic getaway, offering private beach access, a beach bar, and excellent amenities.'
      }
    },
    {
      title: 'Oceanic Overview Suites',
      description: 'A beachfront hotel with modern suites and private beach access.',
      image: 'https://dynamic-media-cdn.tripadvisor.com/media/photo-o/23/56/d3/9b/oceanic-overview-suites.jpg?w=1200&h=-1&s=1',
      detailedInfo: {
        images: [
          'https://media-cdn.tripadvisor.com/media/photo-s/19/63/15/9e/oceanic-overview.jpg',
          'https://media-cdn.tripadvisor.com/media/photo-o/19/63/15/9f/oceanic-overview-pool.jpg',
          'https://media-cdn.tripadvisor.com/media/photo-s/19/63/15/9f/oceanic-overview-room.jpg'
        ],
        additionalInfo: 'Located just 400 meters from Saranda’s port, the hotel has a private beach and modern suites with balconies.'
      }
    },
    {
      title: 'Bougainville Bay Resort',
      description: 'A tranquil resort with an infinity pool and private beach.',
      image: 'https://dynamic-media-cdn.tripadvisor.com/media/photo-o/19/40/e7/20/foto-scattata-dalla-terrazza.jpg?w=800&h=-1&s=1',
      detailedInfo: {
        images: [
          'https://media-cdn.tripadvisor.com/media/photo-s/19/63/15/9b/bougainville-bay.jpg',
          'https://media-cdn.tripadvisor.com/media/photo-o/19/63/15/9e/bougainville-bay-pool.jpg',
          'https://media-cdn.tripadvisor.com/media/photo-s/19/63/15/9d/bougainville-bay-beach.jpg'
        ],
        additionalInfo: 'Bougainville Bay offers serenity with its private beach, infinity pool, and well-appointed rooms.'
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
