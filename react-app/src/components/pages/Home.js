import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import './Home.css';

const Home = () => {
  const [showContent, setShowContent] = useState(false);

  const handleStartExploring = () => {
    setShowContent(true);
  };

  return (
    <div className="home-page">
      <div className="video-container">
        <video autoPlay loop muted className="video-background">
          <source src="/path-to-saranda-video.mp4" type="video/mp4" />
          Your browser does not support the video tag.
        </video>
      </div>
      {!showContent ? (
        <div className="hero-section">
          <div className="overlay-text">
            <h1>Welcome to Saranda!</h1>
            <button className="btn btn-primary" onClick={handleStartExploring}>Start Exploring</button>
          </div>
        </div>
      ) : (
        <div className="home-content">
          <div className="overlay-text">
            <h1>Welcome to Saranda!</h1>
            <p>Discover the beauty of Saranda.</p>
            <div className="action-buttons">
              <Link to="/dine" className="btn btn-primary">Dine</Link>
              <Link to="/stay" className="btn btn-primary">Sleep</Link>
              <Link to="/activities" className="btn btn-primary">Activities</Link>
            </div>
          </div>
        </div>
      )}
      <footer className="footer">
        <p>© 2024 Saranda Tourism. All rights reserved.</p>
      </footer>
    </div>
  );
};

export default Home;
