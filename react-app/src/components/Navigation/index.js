import React from 'react';
import { NavLink } from 'react-router-dom';
import './Navigation.css';

function Navigation() {
  return (
    <nav className="navbar">
      <NavLink exact to="/" className="nav-link">Home</NavLink>
      <NavLink to="/dine" className="nav-link">Dine</NavLink>
      <NavLink to="/stay" className="nav-link">Sleep</NavLink>
      <NavLink to="/activities" className="nav-link">Activities</NavLink>
      <NavLink to="/about" className="nav-link">About Saranda</NavLink>
    </nav>
  );
}

export default Navigation;
