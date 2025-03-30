import React from 'react';
import styled from 'styled-components';
import CarRentalCard from './CarRentalCard';

const ListContainer = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: ${({ theme }) => theme.spacing.lg};
  padding: ${({ theme }) => theme.spacing.lg};
`;

export default function CarRentalList({ rentals }) {
  if (!rentals || rentals.length === 0) return <div>No car rentals available.</div>;
  return (
    <ListContainer>
      {rentals.map((rental) => (
        <CarRentalCard key={rental.id} rental={rental} />
      ))}
    </ListContainer>
  );
}