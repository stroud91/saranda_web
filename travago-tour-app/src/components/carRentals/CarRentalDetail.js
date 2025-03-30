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

const Text = styled.p`
  font-size: 1.1rem;
  margin-bottom: ${({ theme }) => theme.spacing.sm};
`;

export default function CarRentalDetail({ rental }) {
  if (!rental) return <div>Car rental not found.</div>;

  return (
    <DetailWrapper initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.8 }}>
      <Title>{rental.car_model}</Title>
      <Text>Type: {rental.car_type}</Text>
      <Text>Price/Day: ${rental.price_per_day}</Text>
      <Text>Status: {rental.availability_status}</Text>
      <Text>Company: {rental.rental_company}</Text>
      <Text>Location: {rental.location}</Text>
    </DetailWrapper>
  );
}