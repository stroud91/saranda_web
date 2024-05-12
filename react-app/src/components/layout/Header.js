import React from 'react';
import { Link } from 'react-router-dom';
import './Header.scss'; // Assume basic styling is done here

const Header = () => {
  return (
    <header className="site-header">
      <nav>
        <ul>
          <li><Link to="/">Home</Link></li>
          <li><Link to="/accommodations">Accommodations</Link></li>
          <li><Link to="/activities">Activities</Link></li>
          <li><Link to="/dining">Dining</Link></li>
          <li><Link to="/about">About Saranda</Link></li>
        </ul>
      </nav>
    </header>
  );
};

export default Header;
