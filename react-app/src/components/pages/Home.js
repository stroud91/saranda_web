import React from 'react';
import { Link } from 'react-router-dom';
import './Home.scss'; // Ensure styles are set for video and overlays

const Home = () => {
  return (
    <div className="home-page">
      <div className="hero-section">
        <video autoPlay loop muted className="video-background">
          <source src="/path-to-saranda-video.mp4" type="video/mp4" />
          Your browser does not support the video tag.
        </video>
        <div className="overlay-text">
          <h1>Welcome to Saranda!</h1>
          <p>Discover the beauty of Saranda.</p>
          <div className="action-buttons">
            <Link to="/dine" className="btn btn-primary">Dine</Link>
            <Link to="/sleep" className="btn btn-primary">Sleep</Link>
            <Link to="/activities" className="btn btn-primary">Activities</Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Home;
