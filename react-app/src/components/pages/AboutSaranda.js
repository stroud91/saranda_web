import React from 'react';
import './AboutSaranda.css';

const archaeologicalSpots = [
  {
    name: 'Butrint National Park',
    description: 'An ancient city and UNESCO World Heritage site featuring ruins from Greek, Roman, Byzantine, and Venetian periods.',
    image: 'https://placekitten.com/800/400',
  },
  {
    name: 'Lekursi Castle',
    description: 'A restored castle offering panoramic views of Saranda and the surrounding area.',
    image: 'https://placekitten.com/801/400',
  },
  {
    name: 'Blue Eye (Syri i Kaltër)',
    description: 'A stunning natural spring with vibrant blue water, surrounded by lush vegetation.',
    image: 'https://placekitten.com/802/400',
  },
  // Add more spots as needed
];

const coolPictures = [
  'https://placekitten.com/800/400',
  'https://placekitten.com/801/400',
  'https://placekitten.com/802/400',
];

const AboutSaranda = () => {
  return (
    <div className="about-saranda-page">
      <div className="hero-section">
        <h1>Discover Saranda</h1>
        <p>Explore the beauty, history, and culture of Saranda.</p>
      </div>

      <div className="archaeological-section">
        <h2>Archaeological Spots</h2>
        <div className="archaeological-spots">
          {archaeologicalSpots.map((spot, index) => (
            <div key={index} className="archaeological-spot">
              <img src={spot.image} alt={spot.name} className="spot-image" />
              <h3>{spot.name}</h3>
              <p>{spot.description}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="cool-pictures-section">
        <h2>Gallery</h2>
        <div className="cool-pictures">
          {coolPictures.map((pic, index) => (
            <img key={index} src={pic} alt={`Saranda ${index + 1}`} className="cool-picture" />
          ))}
        </div>
      </div>
    </div>
  );
};

export default AboutSaranda;
