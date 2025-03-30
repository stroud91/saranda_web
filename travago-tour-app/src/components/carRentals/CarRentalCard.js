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

const Text = styled.p`
  font-size: 1rem;
  margin-bottom: ${({ theme }) => theme.spacing.sm};
`;

const StyledLink = styled(Link)`
  color: ${({ theme }) => theme.colors.primary};
  font-weight: 600;
  &:hover {
    text-decoration: underline;
  }
`;

export default function CarRentalCard({ rental }) {
  return (
    <Card whileHover={{ scale: 1.02 }}>
      <Title>{rental.car_model}</Title>
      <Text>Type: {rental.car_type}</Text>
      <Text>Price/Day: ${rental.price_per_day}</Text>
      <Text>Status: {rental.availability_status}</Text>
      <Text>Company: {rental.rental_company}</Text>
      <Text>Location: {rental.location}</Text>
      <StyledLink to={`/car-rentals/${rental.id}`}>View Details</StyledLink>
    </Card>
  );
}