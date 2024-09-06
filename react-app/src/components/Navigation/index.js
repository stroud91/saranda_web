import React from 'react';
import { NavLink } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { useModal } from '../../context/Modal';
import LoginFormModal from '../LoginFormModal';
import SignUpFormModal from '../SignUpFormModal';
import { logout } from '../../store/session'; 
import './Navigation.css';

function Navigation() {
  const dispatch = useDispatch();
  const sessionUser = useSelector((state) => state.session.user);  
  const { setModalContent } = useModal();


  const handleLogout = (e) => {
    e.preventDefault();
    dispatch(logout()); 
  };

  return (
    <nav className="navbar">
      <NavLink exact to="/" className="nav-link">Home</NavLink>
      <NavLink to="/dine" className="nav-link">Dine</NavLink>
      <NavLink to="/stay" className="nav-link">Sleep</NavLink>
      <NavLink to="/about" className="nav-link">About Us</NavLink>
      <NavLink to="/saranda" className="nav-link">About Saranda</NavLink>

      {!sessionUser && (  
        <>
          <button onClick={() => setModalContent(<LoginFormModal />)} className="nav-button">Log In</button>
          <button onClick={() => setModalContent(<SignUpFormModal />)} className="nav-button">Sign Up</button>
        </>
      )}

      {sessionUser && ( 
        <>
          <NavLink to="/account" className="nav-link">Account</NavLink>
          <button onClick={handleLogout} className="nav-button">Logout</button>
        </>
      )}
    </nav>
  );
}

export default Navigation;
