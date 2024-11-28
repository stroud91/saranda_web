"use client";
import styles from './Footer.module.css';
import Link from 'next/link';

const Footer = () => {
  return (
    <footer className={styles.footer}>
      <div className={styles.container}>
        <div className={styles.logo}>Travago</div>
        <div className={styles.links}>
          <ul>
            <li><Link href="/about-us">About Us</Link></li>
            <li><Link href="/privacy-policy">Privacy Policy</Link></li>
            <li><Link href="/terms">Terms & Conditions</Link></li>
          </ul>
        </div>
        <div className={styles.contactInfo}>
          <p>Email: bookings@example.com</p>
          <p>Phone: +33 321-654-987</p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;