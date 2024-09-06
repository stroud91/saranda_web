import React from 'react';
import './AboutSaranda.css';
import img1 from '../../images/1.jpg';
import img2 from '../../images/2.jpg';
import img3 from '../../images/3.jpg';
import img4 from '../../images/4.jpg';
import img5 from '../../images/5.jpg';
import img6 from '../../images/6.jpg';
import img7 from '../../images/7.jpg';
import img8 from '../../images/8.jpg';
import img9 from '../../images/9.jpg';
import butrinti from '../../images/butrinti.jpg';
import lekursi from '../../images/lekursi.jpg';
import syriKalter from '../../images/syrikalter.jpg';

const archaeologicalSpots = [
  {
    name: 'Butrint National Park',
    description: 'An ancient city and UNESCO World Heritage site featuring ruins from Greek, Roman, Byzantine, and Venetian periods.',
    image: butrinti,
  },
  {
    name: 'Lekursi Castle',
    description: 'A restored castle offering panoramic views of Saranda and the surrounding area.',
    image: lekursi,
  },
  {
    name: 'Blue Eye (Syri i Kaltër)',
    description: 'A stunning natural spring with vibrant blue water, surrounded by lush vegetation.',
    image: syriKalter,
  },
];

const coolPictures = [
  img1,
  img2,
  img3,
  img4,
  img5,
  img6,
  img7,
  img8,
  img9,
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
