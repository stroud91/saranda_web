"use client";
import styles from "./HeroSection.module.css";
import SearchBar from "./SearchBar";

const HeroSection = () => {
  return (
    <section className={styles.heroSection}>
      <video className={styles.heroVideo} autoPlay muted loop>
        <source src="/videos/hero.mp4" type="video/mp4" />
        Your browser does not support the video tag.
      </video>
      <div className={styles.heroContent}>
        <h1>Explore the beautiful and romantic nature</h1>
        <SearchBar />
      </div>
    </section>
  );
};

export default HeroSection;
