import React from "react";
import styled from "styled-components";
import { motion } from "framer-motion";
import SearchBar from "./SearchBar";
import heroVideo from "../../videos/meg.mp4";

const HeroSectionWrapper = styled.section`
  position: relative;
  height: 80vh;
  width: 100%;
  overflow: hidden;
`;

const HeroVideo = styled.video`
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  z-index: -1;
`;

const HeroContent = styled(motion.div)`
  position: relative;
  z-index: 1;
  text-align: center;
  color: #fff;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  padding: 0 1rem;

  h1 {
    font-size: 2.5rem;
    margin-bottom: 1.5rem;
    text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.5);
  }

  @media (max-width: 768px) {
    h1 {
      font-size: 1.8rem;
    }
  }
`;

const HeroSection = () => {
  return (
    <HeroSectionWrapper>
      <HeroVideo autoPlay muted loop>
        <source src={heroVideo} type="video/mp4" />
        Your browser does not support the video tag.
      </HeroVideo>
      <HeroContent
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1 }}
      >
        <h1>Explore the beautiful and romantic nature</h1>
        <SearchBar />
      </HeroContent>
    </HeroSectionWrapper>
  );
};

export default HeroSection;
