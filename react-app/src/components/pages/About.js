import React from 'react';
import './About.css';
import img1 from '../../images/1.jpg';
import img2 from '../../images/2.jpg';
import img3 from '../../images/3.jpg';
import img4 from '../../images/4.jpg';
import img5 from '../../images/5.jpg';
import img6 from '../../images/6.jpg';
import img7 from '../../images/7.jpg';
import img8 from '../../images/8.jpg';
import img9 from '../../images/9.jpg';
import CEO from '../../images/CEO.jpg';
import CTO from '../../images/CTO.jpg';
import COO from '../../images/COO.jpg';

const teamMembers = [
  {
    name: 'John Doe',
    position: 'CEO',
    image: CEO,
    description: 'John is the visionary behind our company. With over 20 years of experience in the tourism industry, he leads the team with passion and dedication.',
  },
  {
    name: 'Jane Smith',
    position: 'CTO',
    image: CTO,
    description: 'Jane is the tech guru of our company. She ensures that our technology infrastructure is always up-to-date and running smoothly.',
  },
  {
    name: 'Emily Johnson',
    position: 'COO',
    image: COO,
    description: 'Emily oversees the company’s day-to-day operations and makes sure everything is running efficiently.',
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

const About = () => {
  return (
    <div className="about-page">
      <div className="about-section">
        <h1>About Us</h1>
        <p>Welcome to our tourism website. We are dedicated to providing you with the best experience possible in Saranda. Explore the beauty, culture, and history of Saranda with us!</p>
      </div>

      <div className="cool-pictures-section">
        <h2>Discover Saranda</h2>
        <div className="cool-pictures">
          {coolPictures.map((pic, index) => (
            <img key={index} src={pic} alt={`Saranda ${index + 1}`} className="cool-picture" />
          ))}
        </div>
      </div>

      <div className="team-section">
        <h2>Meet the Team</h2>
        <div className="team-members">
          {teamMembers.map((member, index) => (
            <div key={index} className="team-member">
              <img src={member.image} alt={member.name} className="team-member-image" />
              <h3>{member.name}</h3>
              <h4>{member.position}</h4>
              <p>{member.description}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default About;
