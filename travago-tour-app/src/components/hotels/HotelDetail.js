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

export default function HotelDetail({ hotel }) {
  if (!hotel) return <div>Hotel not found.</div>;
  return (
    <DetailWrapper initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.8 }}>
      <Title>{hotel.hotel_name}</Title>
      <Text>Address: {hotel.address}</Text>
      <Text>Price/Night: ${hotel.price_per_night}</Text>
      <Text>Total Rooms: {hotel.total_rooms}</Text>
      <Text>Available Rooms: {hotel.available_rooms}</Text>
      <Text>City: {hotel.city}</Text>
      <Text>Contact: {hotel.contact_email || 'N/A'}</Text>
    </DetailWrapper>
  );
}