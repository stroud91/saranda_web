import React from 'react';
import styled from 'styled-components';
import HotelCard from './HotelCard';

const ListContainer = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 24px;
  padding: 24px;
`;

export default function HotelList({ hotels }) {
  if (!hotels || hotels.length === 0) return <div>No hotels available.</div>;
  return (
    <ListContainer>
      {hotels.map((hotel) => (
        <HotelCard key={hotel.id} hotel={hotel} />
      ))}
    </ListContainer>
  );
}