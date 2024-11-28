"use client";
import Link from 'next/link';
import { useState } from 'react';
import { FaBars, FaTimes, FaUserCircle } from 'react-icons/fa';
import styles from './Navbar.module.css';

const Navbar = () => {
  const [isOpen, setIsOpen] = useState(false);

  const toggleMenu = () => {
    setIsOpen(!isOpen);
  };

  return (
    <header className={styles.header}>
      <div className={styles.logo}>Travago</div>
      <nav className={`${styles.nav} ${isOpen ? styles.open : ''}`}>
        <ul>
          <li><Link href="/">Home</Link></li>
          <li><Link href="/tours">Tours</Link></li>
          <li><Link href="/hotels">Hotels</Link></li>
          <li><Link href="/car-rentals">Car Rentals</Link></li>
          <li><Link href="/contact">Contact Us</Link></li>
        </ul>
        <div className={styles.userIcon}>
          <FaUserCircle size={28} />
        </div>
      </nav>
      <div className={styles.menuToggle} onClick={toggleMenu}>
        {isOpen ? <FaTimes size={24} /> : <FaBars size={24} />}
      </div>
    </header>
  );
};

export default Navbar;