import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import TourDetail from './TourDetail';
import styled from 'styled-components';

const PageWrapper = styled.main`
  padding: ${({ theme }) => theme.spacing.lg};
`;

export default function TourDetailPage() {
  const { id } = useParams();
  const [tour, setTour] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const baseUrl = process.env.REACT_APP_BASE_URL || 'http://localhost:5000';

  useEffect(() => {
    async function fetchTour() {
      try {
        const res = await fetch(`${baseUrl}/api/tours/${id}`);
        if (!res.ok) throw new Error('Failed to fetch tour');
        const data = await res.json();
        setTour(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    fetchTour();
  }, [id, baseUrl]);

  if (loading) return <div>Loading tour...</div>;
  if (error) return <div>Error: {error}</div>;
  if (!tour) return <div>Tour not found.</div>;

  return (
    <PageWrapper>
      <TourDetail tour={tour} />
    </PageWrapper>
  );
}