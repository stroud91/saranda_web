import React from "react";
import styled, { keyframes } from "styled-components";
import { motion } from "framer-motion";
import { FaMapMarkerAlt, FaWhatsapp, FaStar } from "react-icons/fa";
import heroVideo from "../../videos/meg.mp4";

const HeroWrapper = styled.section`
  position: relative;
  height: 100vh;
  min-height: 600px;
  width: 100%;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
`;

const HeroVideo = styled.video`
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  z-index: 0;
`;

const Overlay = styled.div`
  position: absolute;
  inset: 0;
  background: linear-gradient(
    to bottom,
    rgba(0, 0, 0, 0.35) 0%,
    rgba(0, 0, 0, 0.55) 60%,
    rgba(0, 0, 0, 0.72) 100%
  );
  z-index: 1;
`;

const HeroContent = styled(motion.div)`
  position: relative;
  z-index: 2;
  text-align: center;
  color: #fff;
  padding: 0 1.5rem;
  max-width: 780px;
  width: 100%;
`;

const RatingRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  margin-bottom: 1rem;
  font-size: 0.95rem;
  color: rgba(255, 255, 255, 0.9);

  svg {
    color: ${({ theme }) => theme.colors.gold};
    font-size: 1rem;
  }
`;

const HeroTitle = styled.h1`
  font-family: ${({ theme }) => theme.fonts.display};
  font-size: clamp(3rem, 8vw, 5.5rem);
  font-weight: 900;
  line-height: 1;
  margin-bottom: 0.4rem;
  letter-spacing: -1px;
`;

const HeroTagline = styled.p`
  font-family: ${({ theme }) => theme.fonts.script};
  font-size: clamp(1.4rem, 3.5vw, 2.2rem);
  color: ${({ theme }) => theme.colors.accentLight};
  margin-bottom: 1.25rem;
`;

const LocationRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  font-size: 0.9rem;
  color: rgba(255, 255, 255, 0.82);
  margin-bottom: 1rem;

  svg {
    color: ${({ theme }) => theme.colors.gold};
    flex-shrink: 0;
  }
`;

const HeroDesc = styled.p`
  font-size: clamp(0.9rem, 2vw, 1.05rem);
  color: rgba(255, 255, 255, 0.85);
  line-height: 1.65;
  max-width: 600px;
  margin: 0 auto 2rem;
`;

const CTAGroup = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  justify-content: center;
`;

const CTABtn = styled.a`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 0.8rem 1.6rem;
  border-radius: ${({ theme }) => theme.radius.pill};
  font-weight: 600;
  font-size: 0.95rem;
  transition: transform 0.15s, opacity 0.15s;
  cursor: pointer;
  text-decoration: none;

  &:hover {
    transform: translateY(-2px);
    opacity: 0.92;
  }

  &.whatsapp {
    background-color: ${({ theme }) => theme.colors.whatsapp};
    color: #fff;
  }

  &.outline {
    background-color: transparent;
    border: 2px solid rgba(255, 255, 255, 0.75);
    color: #fff;

    &:hover {
      background-color: rgba(255, 255, 255, 0.1);
      border-color: #fff;
    }
  }
`;

const ScrollIndicator = styled(motion.div)`
  position: absolute;
  bottom: 28px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 2;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  color: rgba(255, 255, 255, 0.6);
  font-size: 0.75rem;
  letter-spacing: 1px;
  text-transform: uppercase;
`;

const bounce = keyframes`
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(6px); }
`;

const ScrollArrow = styled.div`
  width: 20px;
  height: 20px;
  border-right: 2px solid rgba(255, 255, 255, 0.5);
  border-bottom: 2px solid rgba(255, 255, 255, 0.5);
  transform: rotate(45deg);
  animation: ${bounce} 1.4s infinite;
`;

const WHATSAPP_URL =
  "https://wa.me/355000000000?text=Hello%2C%20I%27m%20interested%20in%20booking%20a%20Meg%27Rooms%20apartment%20in%20Saran%C3%AB.";

const HeroSection = () => {
  return (
    <HeroWrapper>
      <HeroVideo autoPlay muted loop playsInline>
        <source src={heroVideo} type="video/mp4" />
      </HeroVideo>
      <Overlay />

      <HeroContent
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1, ease: "easeOut" }}
      >
        <RatingRow>
          {[...Array(5)].map((_, i) => (
            <FaStar key={i} />
          ))}
          <span>9.2 / 10 on Booking.com</span>
        </RatingRow>

        <HeroTitle>Meg'Rooms</HeroTitle>
        <HeroTagline>Feels Like Home</HeroTagline>

        <LocationRow>
          <FaMapMarkerAlt />
          <span>Rruga Gjergj Araniti, Sarandë, Albanian Riviera</span>
        </LocationRow>

        <HeroDesc>
          Beachfront apartments with stunning Adriatic views, modern comforts,
          and the warmth of Albanian hospitality. Your perfect Mediterranean
          escape — book directly and save.
        </HeroDesc>

        <CTAGroup>
          <CTABtn
            href={WHATSAPP_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="whatsapp"
          >
            <FaWhatsapp size={18} />
            Chat on WhatsApp
          </CTABtn>
          <CTABtn
            href="https://www.airbnb.com"
            target="_blank"
            rel="noopener noreferrer"
            className="outline"
          >
            View on Airbnb
          </CTABtn>
          <CTABtn
            href="https://www.booking.com"
            target="_blank"
            rel="noopener noreferrer"
            className="outline"
          >
            Booking.com
          </CTABtn>
        </CTAGroup>
      </HeroContent>

      <ScrollIndicator
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.5 }}
      >
        <span>Scroll</span>
        <ScrollArrow />
      </ScrollIndicator>
    </HeroWrapper>
  );
};

export default HeroSection;
