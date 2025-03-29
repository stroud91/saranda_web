import React from 'react';
import { Link } from 'react-router-dom';
import "./Footer.css";

const Footer = () => {
  return (
    <footer className="footer">
      <div className="footerContainer">
        <div className="footerLogo">Meg Rooms</div>
        <div className="footerLinks">
          <ul>
            <li><Link to="/about-us">About Us</Link></li>
            <li><Link to="/privacy-policy">Privacy Policy</Link></li>
            <li><Link to="/terms">Terms & Conditions</Link></li>
          </ul>
        </div>
        <div className="footerContact">
          <p>Email: bookings@example.com</p>
          <p>Phone: +33 321-654-987</p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
