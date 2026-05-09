import React, { useEffect, useState } from "react";
import styled from "styled-components";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { FaCar, FaRoute, FaHome } from "react-icons/fa";
import HeroSection from "./HeroSection";
import AmenitiesSection from "./AmenitiesSection";
import ReviewsSection from "./ReviewsSection";
import ContactSection from "./ContactSection";
import HotelCard from "../hotels/HotelCard";

/* ── Featured apartments section ── */
const AptSection = styled.section`
  padding: 80px 24px;
  background: ${({ theme }) => theme.colors.background};
`;

const Inner = styled.div`
  max-width: 1100px;
  margin: 0 auto;
`;

const SectionHeader = styled.div`
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  margin-bottom: 40px;
  flex-wrap: wrap;
  gap: 12px;
`;

const SectionTitle = styled.h2`
  font-family: ${({ theme }) => theme.fonts.display};
  font-size: 2rem;
  font-weight: 700;
  color: ${({ theme }) => theme.colors.primary};
`;

const SectionDesc = styled.p`
  color: ${({ theme }) => theme.colors.textMuted};
  margin-top: 6px;
  font-size: 0.95rem;
`;

const SeeAllLink = styled(Link)`
  color: ${({ theme }) => theme.colors.primary};
  font-weight: 600;
  font-size: 0.9rem;
  border-bottom: 2px solid ${({ theme }) => theme.colors.gold};
  padding-bottom: 2px;
  white-space: nowrap;

  &:hover {
    color: ${({ theme }) => theme.colors.gold};
  }
`;

const AptGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 24px;

  @media (max-width: 960px) {
    grid-template-columns: repeat(2, 1fr);
  }

  @media (max-width: 600px) {
    grid-template-columns: 1fr;
  }
`;

/* ── Services preview section ── */
const ServicesSection = styled.section`
  background: ${({ theme }) => theme.colors.surfaceAlt};
  padding: 80px 24px;
`;

const ServicesGrid = styled.div`
  max-width: 1100px;
  margin: 0 auto;
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 24px;

  @media (max-width: 620px) {
    grid-template-columns: 1fr;
  }
`;

const ServiceCard = styled(motion(Link))`
  background: ${({ theme }) => theme.colors.surface};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radius.lg};
  padding: 36px 28px;
  display: flex;
  align-items: flex-start;
  gap: 20px;
  text-decoration: none;
  transition: box-shadow 0.2s, transform 0.2s;

  &:hover {
    box-shadow: ${({ theme }) => theme.shadow.elevated};
    transform: translateY(-4px);
  }
`;

const ServiceIcon = styled.div`
  width: 52px;
  height: 52px;
  border-radius: ${({ theme }) => theme.radius.md};
  background: ${({ theme }) => theme.colors.accentLight};
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;

  svg {
    color: ${({ theme }) => theme.colors.primary};
    font-size: 1.4rem;
  }
`;

const ServiceContent = styled.div`
  h3 {
    font-size: 1.1rem;
    font-weight: 700;
    color: ${({ theme }) => theme.colors.primary};
    margin-bottom: 6px;
  }
  p {
    font-size: 0.9rem;
    color: ${({ theme }) => theme.colors.textMuted};
    line-height: 1.55;
  }
`;

/* ── Why Meg'Rooms section ── */
const WhySection = styled.section`
  background: ${({ theme }) => theme.colors.primary};
  padding: 80px 24px;
  text-align: center;
`;

const WhyInner = styled.div`
  max-width: 900px;
  margin: 0 auto;
`;

const WhyTitle = styled.h2`
  font-family: ${({ theme }) => theme.fonts.display};
  font-size: 2rem;
  font-weight: 700;
  color: #fff;
  margin-bottom: 12px;
`;

const WhyText = styled.p`
  color: rgba(255, 255, 255, 0.75);
  font-size: 1.05rem;
  line-height: 1.7;
  margin-bottom: 36px;
`;

const BookDirectBtn = styled(Link)`
  display: inline-flex;
  align-items: center;
  background-color: ${({ theme }) => theme.colors.gold};
  color: ${({ theme }) => theme.colors.primary};
  font-weight: 700;
  font-size: 1rem;
  padding: 0.9rem 2.2rem;
  border-radius: ${({ theme }) => theme.radius.pill};
  transition: background-color 0.2s, transform 0.15s;

  &:hover {
    background-color: #b8933e;
    transform: translateY(-2px);
  }
`;

const services = [
  {
    icon: FaRoute,
    to: "/tours",
    title: "Guided Tours",
    desc: "Explore Butrint UNESCO site, the Blue Eye spring, and Gjirokastër — all with expert local guides.",
  },
  {
    icon: FaCar,
    to: "/car-rentals",
    title: "Car Rentals",
    desc: "Drive the Albanian Riviera at your own pace. Flexible daily rates with free airport delivery.",
  },
];

const containerVariants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.1 },
  },
};

const cardVariants = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4 } },
};

const HomePage = () => {
  const [apartments, setApartments] = useState([]);

  useEffect(() => {
    fetch("/api/hotels")
      .then((r) => r.json())
      .then((data) => setApartments(data.slice(0, 3)))
      .catch(() => {});
  }, []);

  return (
    <>
      <HeroSection />

      {/* Featured Apartments */}
      <AptSection id="apartments">
        <Inner>
          <SectionHeader>
            <div>
              <SectionTitle>Our Apartments</SectionTitle>
              <SectionDesc>
                Beachfront units in Sarandë — each with sea views and a unique
                character
              </SectionDesc>
            </div>
            <SeeAllLink to="/hotels">View all →</SeeAllLink>
          </SectionHeader>

          <motion.div
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-80px" }}
          >
            <AptGrid>
              {apartments.map((apt) => (
                <motion.div key={apt.id} variants={cardVariants}>
                  <HotelCard hotel={apt} />
                </motion.div>
              ))}
            </AptGrid>
          </motion.div>
        </Inner>
      </AptSection>

      {/* Amenities */}
      <AmenitiesSection />

      {/* Reviews */}
      <ReviewsSection />

      {/* Additional Services */}
      <ServicesSection>
        <Inner>
          <SectionHeader>
            <div>
              <SectionTitle>Explore More</SectionTitle>
              <SectionDesc>
                Complete your Sarandë experience with our curated add-ons
              </SectionDesc>
            </div>
          </SectionHeader>
          <ServicesGrid>
            {services.map((s) => (
              <ServiceCard key={s.to} to={s.to} whileHover={{ scale: 1.01 }}>
                <ServiceIcon>
                  <s.icon />
                </ServiceIcon>
                <ServiceContent>
                  <h3>{s.title}</h3>
                  <p>{s.desc}</p>
                </ServiceContent>
              </ServiceCard>
            ))}
          </ServicesGrid>
        </Inner>
      </ServicesSection>

      {/* Why Book Direct */}
      <WhySection>
        <WhyInner>
          <WhyTitle>Why Book Directly?</WhyTitle>
          <WhyText>
            Skip the platform fees. When you book direct through MegRooms.com
            you get the best available rate, instant confirmation, and a direct
            line to your host. We're always available on WhatsApp for any
            questions before, during, or after your stay.
          </WhyText>
          <BookDirectBtn to="/hotels">
            <FaHome style={{ marginRight: 8 }} />
            Browse Apartments
          </BookDirectBtn>
        </WhyInner>
      </WhySection>

      {/* Contact */}
      <ContactSection />
    </>
  );
};

export default HomePage;
