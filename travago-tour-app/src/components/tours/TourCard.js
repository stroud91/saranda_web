import React from 'react';
import { Link } from 'react-router-dom';
import styled from 'styled-components';
import { motion } from 'framer-motion';

const Card = styled(motion.div)`
  background: ${({ theme }) => theme.colors.surface};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: 8px;
  padding: ${({ theme }) => theme.spacing.md};
  box-shadow: 0 4px 6px rgba(0,0,0,0.1);
  transition: transform 0.3s ease;
  &:hover {
    transform: translateY(-5px);
  }
`;

const Title = styled.h2`
  font-size: 1.5rem;
  margin-bottom: ${({ theme }) => theme.spacing.sm};
  color: ${({ theme }) => theme.colors.primary};
`;

const Description = styled.p`
  font-size: 1rem;
  margin-bottom: ${({ theme }) => theme.spacing.sm};
`;

const Price = styled.p`
  font-size: 1.1rem;
  font-weight: bold;
  margin-bottom: ${({ theme }) => theme.spacing.sm};
`;

const StyledLink = styled(Link)`
  color: ${({ theme }) => theme.colors.primary};
  text-decoration: none;
  font-weight: 600;
  &:hover {
    text-decoration: underline;
  }
`;

export default function TourCard({ tour }) {
  return (
    <Card whileHover={{ scale: 1.02 }}>
      <Title>{tour.tour_name}</Title>
      <Description>{tour.description}</Description>
      <Price>Price: ${tour.price}</Price>
      <StyledLink to={`/tours/${tour.id}`}>View Details</StyledLink>
    </Card>
  );
}