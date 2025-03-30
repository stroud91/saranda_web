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
  const baseUrl = process.env.REACT_APP_BASE_URL || 'http://localhost:5000';

  useEffect(() => {
    async function fetchRentals() {
      try {
        const res = await fetch(`${baseUrl}/api/car_rentals`);
        if (!res.ok) throw new Error('Failed to fetch car rentals');
        const data = await res.json();
        setRentals(data.car_rentals || []);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    fetchRentals();
  }, [baseUrl]);

  if (loading) return <div>Loading car rentals...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <PageWrapper>
      <h1>All Car Rentals</h1>
      <CarRentalList rentals={rentals} />
    </PageWrapper>
  );
}