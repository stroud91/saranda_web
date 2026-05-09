import React from "react";
import styled from "styled-components";
import {
  FaWifi,
  FaSnowflake,
  FaUmbrellaBeach,
  FaUtensils,
  FaTv,
  FaParking,
  FaShower,
  FaWater,
  FaBed,
  FaWindowMaximize,
} from "react-icons/fa";

const Section = styled.section`
  background-color: ${({ theme }) => theme.colors.surfaceAlt};
  padding: 80px 24px;
`;

const Inner = styled.div`
  max-width: 1100px;
  margin: 0 auto;
  text-align: center;
`;

const Title = styled.h2`
  font-family: ${({ theme }) => theme.fonts.display};
  font-size: 2rem;
  font-weight: 700;
  color: ${({ theme }) => theme.colors.primary};
  margin-bottom: 8px;
`;

const Subtitle = styled.p`
  color: ${({ theme }) => theme.colors.textMuted};
  font-size: 1.05rem;
  margin-bottom: 48px;
`;

const Grid = styled.div`
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 24px;

  @media (max-width: 900px) {
    grid-template-columns: repeat(3, 1fr);
  }

  @media (max-width: 560px) {
    grid-template-columns: repeat(2, 1fr);
  }
`;

const AmenityItem = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 24px 12px;
  background: ${({ theme }) => theme.colors.surface};
  border-radius: ${({ theme }) => theme.radius.md};
  border: 1px solid ${({ theme }) => theme.colors.border};
  transition: transform 0.2s, box-shadow 0.2s;

  &:hover {
    transform: translateY(-4px);
    box-shadow: ${({ theme }) => theme.shadow.card};
  }

  svg {
    color: ${({ theme }) => theme.colors.gold};
    font-size: 1.8rem;
  }

  span {
    font-size: 0.85rem;
    font-weight: 500;
    color: ${({ theme }) => theme.colors.text};
    text-align: center;
  }
`;

const amenities = [
  { icon: FaWifi, label: "Free WiFi" },
  { icon: FaSnowflake, label: "Air Conditioning" },
  { icon: FaUmbrellaBeach, label: "Beachfront" },
  { icon: FaUtensils, label: "Full Kitchen" },
  { icon: FaTv, label: "Smart TV" },
  { icon: FaParking, label: "Free Parking" },
  { icon: FaShower, label: "Hot Shower" },
  { icon: FaWindowMaximize, label: "Private Balcony" },
  { icon: FaWater, label: "Sea View" },
  { icon: FaBed, label: "Premium Linens" },
];

const AmenitiesSection = () => (
  <Section id="amenities">
    <Inner>
      <Title>What's Included</Title>
      <Subtitle>Every apartment comes fully equipped for your comfort</Subtitle>
      <Grid>
        {amenities.map(({ icon: Icon, label }) => (
          <AmenityItem key={label}>
            <Icon />
            <span>{label}</span>
          </AmenityItem>
        ))}
      </Grid>
    </Inner>
  </Section>
);

export default AmenitiesSection;
