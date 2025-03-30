import React, { useEffect, useState } from 'react';
import TourList from './TourList';
import styled from 'styled-components';

const PageWrapper = styled.main`
  padding: ${({ theme }) => theme.spacing.lg};
`;

export default function TourListPage() {
  const [tours, setTours] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const baseUrl = process.env.REACT_APP_BASE_URL || 'http://localhost:5000';

  useEffect(() => {
    async function fetchTours() {
      try {
        const res = await fetch(`${baseUrl}/api/tours`);
        if (!res.ok) throw new Error('Failed to fetch tours');
        const data = await res.json();
        setTours(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    fetchTours();
  }, [baseUrl]);

  if (loading) return <div>Loading tours...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <PageWrapper>
      <h1>All Tours</h1>
      <TourList tours={tours} />
    </PageWrapper>
  );
}