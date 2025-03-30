import React from 'react';
import styled from 'styled-components';
import TourCard from './TourCard';

const ListContainer = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: ${({ theme }) => theme.spacing.lg};
  padding: ${({ theme }) => theme.spacing.lg};
`;

export default function TourList({ tours }) {
  if (!tours || tours.length === 0) return <div>No tours available.</div>;

  return (
    <ListContainer>
      {tours.map((tour) => (
        <TourCard key={tour.id} tour={tour} />
      ))}
    </ListContainer>
  );
}