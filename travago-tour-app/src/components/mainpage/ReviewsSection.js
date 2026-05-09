import React from "react";
import styled from "styled-components";
import { FaStar, FaQuoteLeft } from "react-icons/fa";

const Section = styled.section`
  background: ${({ theme }) => theme.colors.surface};
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
  margin-bottom: 16px;
`;

const BadgeRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  margin-bottom: 48px;
`;

const ScoreBadge = styled.div`
  background: ${({ theme }) => theme.colors.primary};
  color: #fff;
  border-radius: ${({ theme }) => theme.radius.md};
  padding: 10px 20px;
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 700;
  font-size: 1rem;

  svg {
    color: ${({ theme }) => theme.colors.gold};
  }
`;

const Grid = styled.div`
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 24px;

  @media (max-width: 768px) {
    grid-template-columns: 1fr;
  }
`;

const ReviewCard = styled.div`
  background: ${({ theme }) => theme.colors.surfaceAlt};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radius.md};
  padding: 28px 24px;
  text-align: left;
`;

const QuoteIcon = styled.div`
  color: ${({ theme }) => theme.colors.gold};
  margin-bottom: 12px;
  font-size: 1.2rem;
`;

const ReviewText = styled.p`
  font-size: 0.95rem;
  line-height: 1.7;
  color: ${({ theme }) => theme.colors.text};
  margin-bottom: 20px;
  font-style: italic;
`;

const ReviewerRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
`;

const ReviewerInfo = styled.div`
  span:first-child {
    display: block;
    font-weight: 600;
    font-size: 0.9rem;
  }
  span:last-child {
    font-size: 0.8rem;
    color: ${({ theme }) => theme.colors.textMuted};
  }
`;

const Stars = styled.div`
  display: flex;
  gap: 2px;
  color: ${({ theme }) => theme.colors.gold};
  font-size: 0.8rem;
`;

const SourceBadge = styled.span`
  font-size: 0.72rem;
  padding: 3px 8px;
  border-radius: ${({ theme }) => theme.radius.pill};
  background: ${({ $source, theme }) =>
    $source === "Booking.com" ? theme.colors.bookingCom : theme.colors.airbnb};
  color: #fff;
  font-weight: 600;
`;

const reviews = [
  {
    text: "A wonderful stay! The sea views were breathtaking and the apartment was spotless. The host was incredibly helpful before and during our stay.",
    name: "Maria K.",
    country: "Germany",
    score: 5,
    source: "Booking.com",
  },
  {
    text: "Perfect location for exploring Sarandë. Everything was clean, modern, and exactly as described. The balcony views of the Adriatic were unforgettable.",
    name: "James T.",
    country: "United Kingdom",
    score: 5,
    source: "Airbnb",
  },
  {
    text: "Best value on the Albanian Riviera. We'll definitely be back next summer! The kitchen was fully stocked and the WiFi was fast.",
    name: "Sophie L.",
    country: "France",
    score: 5,
    source: "Airbnb",
  },
];

const ReviewsSection = () => (
  <Section id="reviews">
    <Inner>
      <Title>What Our Guests Say</Title>
      <Subtitle>Verified reviews from real guests</Subtitle>
      <BadgeRow>
        <ScoreBadge>
          <FaStar />
          9.2 / 10 on Booking.com
        </ScoreBadge>
        <ScoreBadge style={{ background: "#FF5A5F" }}>
          <FaStar />
          4.7 / 5 on Airbnb
        </ScoreBadge>
      </BadgeRow>
      <Grid>
        {reviews.map((r) => (
          <ReviewCard key={r.name}>
            <QuoteIcon>
              <FaQuoteLeft />
            </QuoteIcon>
            <ReviewText>"{r.text}"</ReviewText>
            <ReviewerRow>
              <ReviewerInfo>
                <span>{r.name}</span>
                <span>{r.country}</span>
              </ReviewerInfo>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "4px" }}>
                <Stars>
                  {[...Array(r.score)].map((_, i) => (
                    <FaStar key={i} />
                  ))}
                </Stars>
                <SourceBadge $source={r.source}>{r.source}</SourceBadge>
              </div>
            </ReviewerRow>
          </ReviewCard>
        ))}
      </Grid>
    </Inner>
  </Section>
);

export default ReviewsSection;
