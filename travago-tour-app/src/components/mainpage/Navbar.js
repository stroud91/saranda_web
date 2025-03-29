import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { FaBars, FaTimes, FaUserCircle } from 'react-icons/fa';
import "./Navbar.css";

const Navbar = () => {
  const [isOpen, setIsOpen] = useState(false);
  const toggleMenu = () => setIsOpen(!isOpen);

  return (
    <header className="navbarHeader">
      <div className="logo">Meg Rooms</div>
      <nav className={`nav ${isOpen ? 'open' : ''}`}>
        <ul>
          <li><Link to="/">Home</Link></li>
          <li><Link to="/tours">Tours</Link></li>
          <li><Link to="/hotels">Hotels</Link></li>
          <li><Link to="/car-rentals">Car Rentals</Link></li>
          <li><Link to="/contact">Contact Us</Link></li>
        </ul>
        <div className="userIcon">
          <FaUserCircle size={28} />
        </div>
      </nav>
      <div className="menuToggle" onClick={toggleMenu}>
        {isOpen ? <FaTimes size={24} /> : <FaBars size={24} />}
      </div>
    </header>
  );
};

export default Navbar;
