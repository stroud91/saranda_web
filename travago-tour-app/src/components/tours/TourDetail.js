import React from 'react';
import styled from 'styled-components';
import { motion } from 'framer-motion';

const DetailWrapper = styled(motion.div)`
  background: ${({ theme }) => theme.colors.surface};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: 8px;
  padding: ${({ theme }) => theme.spacing.lg};
  margin: ${({ theme }) => theme.spacing.lg} auto;
  max-width: 800px;
  box-shadow: 0 6px 10px rgba(0,0,0,0.15);
`;

const Title = styled.h1`
  font-size: 2rem;
  margin-bottom: ${({ theme }) => theme.spacing.md};
  color: ${({ theme }) => theme.colors.primary};
`;

const Paragraph = styled.p`
  font-size: 1.1rem;
  margin-bottom: ${({ theme }) => theme.spacing.sm};
`;

export default function TourDetail({ tour }) {
  if (!tour) return <div>Tour not found.</div>;

  return (
    <DetailWrapper initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.8 }}>
      <Title>{tour.tour_name}</Title>
      <Paragraph>Description: {tour.description}</Paragraph>
      <Paragraph>Price: ${tour.price}</Paragraph>
      <Paragraph>Start: {tour.start_date}</Paragraph>
      <Paragraph>End: {tour.end_date}</Paragraph>
      <Paragraph>Location: {tour.location}</Paragraph>
      <Paragraph>Available: {tour.is_available ? 'Yes' : 'No'}</Paragraph>
    </DetailWrapper>
  );
}