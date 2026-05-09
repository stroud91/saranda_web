import React, { useEffect, useState } from 'react';
import CarRentalList from './CarRentalList';
import styled from 'styled-components';

const PageWrapper = styled.main`
  padding: ${({ theme }) => theme.spacing.lg};
`;

export default function CarRentalListPage() {
  const [rentals, setRentals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  useEffect(() => {
    fetch('/api/car_rentals')
      .then((r) => {
        if (!r.ok) throw new Error('Failed to fetch car rentals');
        return r.json();
      })
      .then(setRentals)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div style={{ padding: '120px 24px', textAlign: 'center' }}>Loading car rentals…</div>;
  if (error) return <div style={{ padding: '120px 24px', textAlign: 'center' }}>Error: {error}</div>;

  return (
    <PageWrapper>
      <h1 style={{ paddingTop: '90px', paddingBottom: '24px', fontFamily: 'inherit', fontSize: '2rem' }}>
        Car Rentals
      </h1>
      <CarRentalList rentals={rentals} />
    </PageWrapper>
  );
}