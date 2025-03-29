// src/components/HeroSection.js
import React from "react";
import SearchBar from "./SearchBar";
import heroVideo from "../../videos/meg.mp4";
import "./HeroSection.css";

const HeroSection = () => {
  return (
    <section className="heroSection">
      <video className="heroVideo" autoPlay muted loop>
        <source src={heroVideo} type="video/mp4" />
        Your browser does not support the video tag.
      </video>
      <div className="heroContent">
        <h1>Explore the beautiful and romantic nature</h1>
        <SearchBar />
      </div>
    </section>
  );
};

export default HeroSection;
