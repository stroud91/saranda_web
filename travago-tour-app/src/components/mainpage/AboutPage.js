import React from "react";
import styled from "styled-components";
import { Link } from "react-router-dom";
import { FaRoute, FaCar, FaHome, FaUmbrellaBeach, FaAnchor, FaMountain } from "react-icons/fa";

const PageHeader = styled.div`
  background: ${({ theme }) => theme.colors.primary};
  padding: 120px 24px 64px;
  text-align: center;
`;

const PageTitle = styled.h1`
  font-family: ${({ theme }) => theme.fonts.display};
  font-size: 2.8rem;
  font-weight: 700;
  color: #fff;
  margin-bottom: 8px;
`;

const Tagline = styled.p`
  font-family: ${({ theme }) => theme.fonts.script};
  font-size: 1.6rem;
  color: ${({ theme }) => theme.colors.gold};
`;

const Section = styled.section`
  padding: 64px 24px;
  background: ${({ theme, $alt }) => $alt ? theme.colors.surfaceAlt : theme.colors.surface};
`;

const Inner = styled.div`
  max-width: 860px;
  margin: 0 auto;
`;

const SectionTitle = styled.h2`
  font-family: ${({ theme }) => theme.fonts.display};
  font-size: 1.8rem;
  font-weight: 700;
  color: ${({ theme }) => theme.colors.primary};
  margin-bottom: 16px;
`;

const Body = styled.p`
  color: ${({ theme }) => theme.colors.text};
  line-height: 1.8;
  font-size: 1rem;
  margin-bottom: 16px;
`;

const HighlightGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 20px;
  margin-top: 32px;

  @media (max-width: 600px) {
    grid-template-columns: 1fr;
  }
`;

const HighlightCard = styled.div`
  background: ${({ theme }) => theme.colors.surface};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radius.md};
  padding: 24px;
  text-align: center;

  svg {
    color: ${({ theme }) => theme.colors.gold};
    font-size: 1.8rem;
    margin-bottom: 12px;
  }

  h3 {
    font-size: 0.95rem;
    font-weight: 700;
    color: ${({ theme }) => theme.colors.primary};
    margin-bottom: 6px;
  }

  p {
    font-size: 0.85rem;
    color: ${({ theme }) => theme.colors.textMuted};
    line-height: 1.5;
  }
`;

const CtaSection = styled.div`
  text-align: center;
  padding: 64px 24px;
  background: ${({ theme }) => theme.colors.primary};
`;

const CtaTitle = styled.h2`
  font-family: ${({ theme }) => theme.fonts.display};
  font-size: 2rem;
  color: #fff;
  margin-bottom: 24px;
`;

const CtaBtn = styled(Link)`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  background: ${({ theme }) => theme.colors.gold};
  color: ${({ theme }) => theme.colors.primary};
  font-weight: 700;
  padding: 0.9rem 2rem;
  border-radius: ${({ theme }) => theme.radius.pill};
  font-size: 1rem;

  &:hover {
    background: #b8933e;
  }
`;

const highlights = [
  { icon: FaUmbrellaBeach, title: "Beachfront Location", desc: "Steps from Sarandë's golden beach and the azure Ionian Sea" },
  { icon: FaAnchor, title: "Albanian Riviera", desc: "Gateway to Butrint, Ksamil, Blue Eye, and the Ionian coast" },
  { icon: FaMountain, title: "Stunning Views", desc: "Panoramic views of Corfu Island and the Albanian mountains" },
  { icon: FaHome, title: "Home Comforts", desc: "Fully equipped kitchens, fast WiFi, and premium linens" },
  { icon: FaRoute, title: "Local Guides", desc: "Expert-led tours to Albania's most beautiful destinations" },
  { icon: FaCar, title: "Flexible Mobility", desc: "Car rentals to explore the Riviera at your own pace" },
];

const AboutPage = () => (
  <>
    <PageHeader>
      <PageTitle>About Meg'Rooms</PageTitle>
      <Tagline>Feels Like Home</Tagline>
    </PageHeader>

    <Section>
      <Inner>
        <SectionTitle>Our Story</SectionTitle>
        <Body>
          Meg'Rooms is a collection of carefully designed beachfront apartments
          in the heart of Sarandë, on Albania's stunning Ionian Riviera. We
          started with a simple belief: that every traveler deserves a place
          that truly feels like home — comfortable, welcoming, and beautiful.
        </Body>
        <Body>
          Located on Rruga Gjergj Araniti, our apartments overlook the Ionian
          Sea with direct views of Corfu Island. Each unit is unique — from cozy
          sunset studios to spacious family suites — but all share the same
          commitment to quality, cleanliness, and personal hospitality.
        </Body>
        <Body>
          We've been rated <strong>9.2/10 on Booking.com</strong> and
          consistently above <strong>4.7 stars on Airbnb</strong>. We're proud
          of that, but we're even prouder of the personal relationships we've
          built with guests who return year after year.
        </Body>
      </Inner>
    </Section>

    <Section $alt>
      <Inner>
        <SectionTitle>Why Sarandë?</SectionTitle>
        <Body>
          Sarandë is the jewel of the Albanian Riviera — a sun-drenched port
          city that offers everything a Mediterranean vacation should: crystal
          clear waters, ancient ruins, delicious food, and friendly locals.
          Just 45 minutes from Corfu by ferry, it's easily one of Europe's
          best-kept secrets.
        </Body>
        <Body>
          Nearby you'll find the UNESCO-listed Butrint National Park, the
          magical Blue Eye spring, the pristine beaches of Ksamil, and the
          historic castle of Gjirokastër. We'll help you explore all of it.
        </Body>

        <HighlightGrid>
          {highlights.map(({ icon: Icon, title, desc }) => (
            <HighlightCard key={title}>
              <Icon />
              <h3>{title}</h3>
              <p>{desc}</p>
            </HighlightCard>
          ))}
        </HighlightGrid>
      </Inner>
    </Section>

    <CtaSection>
      <CtaTitle>Ready to experience Sarandë?</CtaTitle>
      <CtaBtn to="/hotels">
        <FaHome />
        Browse Our Apartments
      </CtaBtn>
    </CtaSection>
  </>
);

export default AboutPage;
