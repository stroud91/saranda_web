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
  useEffect(() => {
    fetch('/api/tours')
      .then((r) => {
        if (!r.ok) throw new Error('Failed to fetch tours');
        return r.json();
      })
      .then(setTours)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div style={{ padding: '120px 24px', textAlign: 'center' }}>Loading tours…</div>;
  if (error) return <div style={{ padding: '120px 24px', textAlign: 'center' }}>Error: {error}</div>;

  return (
    <PageWrapper>
      <h1 style={{ paddingTop: '90px', paddingBottom: '24px', fontFamily: 'inherit', fontSize: '2rem' }}>
        Guided Tours
      </h1>
      <TourList tours={tours} />
    </PageWrapper>
  );
}