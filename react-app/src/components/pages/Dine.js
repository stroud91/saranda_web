import React, { useEffect } from 'react';
import Card from '../Card/Card';
import './Page.css';

const Dine = () => {
  const cardsData = [
    {
      title: 'Mare Nostrum',
      description: 'Seafood delicacies with Mediterranean and Balkan influences.',
      image: 'https://dynamic-media-cdn.tripadvisor.com/media/photo-o/14/56/24/01/20180826-193254-largejpg.jpg?w=800&h=-1&s=1',
      detailedInfo: {
        images: [
          'https://media-cdn.tripadvisor.com/media/photo-s/0d/1f/21/4f/mare-nostrum-cuisine.jpg',
          'https://media-cdn.tripadvisor.com/media/photo-o/0f/52/21/7c/mare-nostrum.jpg',
          'https://media-cdn.tripadvisor.com/media/photo-s/0d/1f/21/4f/mare-nostrum-dishes.jpg'
        ],
        additionalInfo: 'Located along the boulevard, Mare Nostrum offers delicious seafood dishes with Mediterranean and Balkan flavors.'
      }
    },
    {
      title: 'Limani',
      description: 'Mediterranean dishes with a waterfront view.',
      image: 'https://dynamic-media-cdn.tripadvisor.com/media/photo-o/1c/d4/90/4d/restaurant-beach-view.jpg?w=1200&h=-1&s=1',
      detailedInfo: {
        images: [
          'https://media-cdn.tripadvisor.com/media/photo-s/18/71/25/d6/limani-restaurant.jpg',
          'https://media-cdn.tripadvisor.com/media/photo-o/18/71/25/cb/limani-restaurant.jpg',
          'https://media-cdn.tripadvisor.com/media/photo-s/18/71/25/e3/limani-dining.jpg'
        ],
        additionalInfo: 'Situated on the waterfront promenade, Limani offers stunning views and a great Mediterranean menu.'
      }
    },
    {
      title: 'Gërthëla',
      description: 'Healthy and contemporary seafood and pasta.',
      image: 'https://dynamic-media-cdn.tripadvisor.com/media/photo-o/04/c5/1f/5d/gerthela.jpg?w=1200&h=-1&s=1',
      detailedInfo: {
        images: [
          'https://media-cdn.tripadvisor.com/media/photo-s/18/52/31/1f/gerthla-restaurant.jpg',
          'https://media-cdn.tripadvisor.com/media/photo-o/18/52/31/32/gerthla-outdoor-dining.jpg',
          'https://media-cdn.tripadvisor.com/media/photo-s/18/52/31/28/gerthla-dining-view.jpg'
        ],
        additionalInfo: 'Gërthëla offers healthy contemporary cuisine with a variety of seafood and pasta options in Saranda.'
      }
    },
    {
      title: 'Taverna Lamce',
      description: 'Traditional Albanian cuisine in a cozy setting.',
      image: 'https://dynamic-media-cdn.tripadvisor.com/media/photo-o/2c/d9/70/76/caption.jpg?w=1100&h=-1&s=1',
      detailedInfo: {
        images: [
          'https://media-cdn.tripadvisor.com/media/photo-s/13/36/48/1e/taverna-lamce.jpg',
          'https://media-cdn.tripadvisor.com/media/photo-o/13/36/48/1f/taverna-lamce-dining.jpg',
          'https://media-cdn.tripadvisor.com/media/photo-s/13/36/48/2a/taverna-lamce-dishes.jpg'
        ],
        additionalInfo: 'Enjoy a traditional Albanian meal in the cozy and authentic Taverna Lamce.'
      }
    },
    {
      title: 'Rustico',
      description: 'Local seafood and traditional dishes at affordable prices.',
      image: 'https://dynamic-media-cdn.tripadvisor.com/media/photo-s/03/11/d3/01/rustico.jpg?w=600&h=-1&s=1',
      detailedInfo: {
        images: [
          'https://media-cdn.tripadvisor.com/media/photo-s/18/63/11/8b/rustico-restaurant.jpg',
          'https://media-cdn.tripadvisor.com/media/photo-o/18/63/11/88/rustico-dining.jpg',
          'https://media-cdn.tripadvisor.com/media/photo-s/18/63/11/89/rustico-food.jpg'
        ],
        additionalInfo: 'Rustico serves a wide selection of local seafood and traditional dishes in a friendly setting.'
      }
    },
    {
      title: 'Art Sushi',
      description: 'Saranda’s first Japanese restaurant with sushi and seafood.',
      image: 'https://dynamic-media-cdn.tripadvisor.com/media/photo-o/1b/b6/6c/1d/prawdziwe-smaki-wschodu.jpg?w=1200&h=-1&s=1',
      detailedInfo: {
        images: [
          'https://media-cdn.tripadvisor.com/media/photo-s/12/45/03/49/art-sushi.jpg',
          'https://media-cdn.tripadvisor.com/media/photo-o/12/45/03/50/art-sushi-bar.jpg',
          'https://media-cdn.tripadvisor.com/media/photo-s/12/45/03/51/art-sushi-dining.jpg'
        ],
        additionalInfo: 'Art Sushi offers an excellent selection of sushi and seafood in the heart of Saranda.'
      }
    },
    {
      title: 'Mucobega Beach Bar & Restaurant',
      description: 'A quiet seaside retreat with Mediterranean cuisine.',
      image: 'https://dynamic-media-cdn.tripadvisor.com/media/photo-o/2c/b8/6c/38/sorroundings.jpg?w=1100&h=-1&s=1',
      detailedInfo: {
        images: [
          'https://media-cdn.tripadvisor.com/media/photo-s/18/7e/2c/56/mucobega-restaurant.jpg',
          'https://media-cdn.tripadvisor.com/media/photo-o/18/7e/2c/54/mucobega-dining-view.jpg',
          'https://media-cdn.tripadvisor.com/media/photo-s/18/7e/2c/57/mucobega-food.jpg'
        ],
        additionalInfo: 'Located on a quiet part of the Saranda coastline, Mucobega offers Mediterranean dishes and amazing sea views.'
      }
    },
    {
      title: 'Bar Restaurant Aragosta',
      description: 'Mediterranean dishes served by the sea.',
      image: 'https://dynamic-media-cdn.tripadvisor.com/media/photo-o/13/bc/27/4c/ta-img-20180717-162355.jpg?w=1100&h=-1&s=1',
      detailedInfo: {
        images: [
          'https://media-cdn.tripadvisor.com/media/photo-s/12/3b/98/57/bar-aragosta.jpg',
          'https://media-cdn.tripadvisor.com/media/photo-o/12/3b/98/58/bar-aragosta-dining.jpg',
          'https://media-cdn.tripadvisor.com/media/photo-s/12/3b/98/59/bar-aragosta-dishes.jpg'
        ],
        additionalInfo: 'Bar Restaurant Aragosta serves a wide variety of Mediterranean dishes right on the beach.'
      }
    },
    {
      title: 'Onhezmi Lounge Bar & Restaurant',
      description: 'Cozy atmosphere with a Mediterranean and European menu.',
      image: 'https://dynamic-media-cdn.tripadvisor.com/media/photo-o/24/67/f4/f1/outside-view-of-the-restaurant.jpg?w=1200&h=-1&s=1',
      detailedInfo: {
        images: [
          'https://media-cdn.tripadvisor.com/media/photo-s/18/71/25/d6/onhezmi-restaurant.jpg',
          'https://media-cdn.tripadvisor.com/media/photo-o/18/71/25/cb/onhezmi-dining.jpg',
          'https://media-cdn.tripadvisor.com/media/photo-s/18/71/25/e3/onhezmi-food.jpg'
        ],
        additionalInfo: 'Onhezmi offers a relaxed Mediterranean dining experience, located near the port of Saranda.'
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
      <h1>Dine</h1>
      <div className="card-container">
        {cardsData.map((card, index) => (
          <Card key={index} title={card.title} description={card.description} image={card.image} detailedInfo={card.detailedInfo} />
        ))}
      </div>
    </div>
  );
};

export default Dine;
