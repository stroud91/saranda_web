"use client";
import styles from './HeroSection.module.css';
import Image from 'next/image';
import heroImage from '../../../public/images/hero.jpg';
import SearchBar from './SearchBar';

const HeroSection = () => {
  return (
    <section className={styles.heroSection}>
      <Image src={heroImage} alt="Scenic view" className={styles.heroImage} />
      <div className={styles.heroContent}>
        <h1>Explore the beautiful and romantic nature</h1>
        <SearchBar />
      </div>
    </section>
  );
};

export default HeroSection;