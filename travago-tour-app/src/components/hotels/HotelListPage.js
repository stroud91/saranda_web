import React, { useEffect, useState } from 'react';
import HotelList from './HotelList';
import styled from 'styled-components';

const PageWrapper = styled.main`
  padding: ${({ theme }) => theme.spacing.lg};
`;

export default function HotelListPage() {
  const [hotels, setHotels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const baseUrl = process.env.REACT_APP_BASE_URL || 'http://localhost:5000';

  useEffect(() => {
    async function fetchHotels() {
      try {
        const res = await fetch(`${baseUrl}/api/hotels`);
        if (!res.ok) throw new Error('Failed to fetch hotels');
        const data = await res.json();
        setHotels(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    fetchHotels();
  }, [baseUrl]);

  if (loading) return <div>Loading hotels...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <PageWrapper>
      <h1>All Hotels</h1>
      <HotelList hotels={hotels} />
    </PageWrapper>
  );
}