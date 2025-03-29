import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import CarRentalDetail from './CarRentalDetail';

const baseUrl = process.env.REACT_APP_BASE_URL || 'http://localhost:5000';

export default function CarRentalDetailPage() {
  const { id } = useParams();
  const [rental, setRental] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function fetchRental() {
      try {
        const res = await fetch(`${baseUrl}/api/car_rentals/${id}`);
        if (!res.ok) {
          throw new Error('Failed to fetch car rental');
        }
        const data = await res.json();
        setRental(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    fetchRental();
  }, [id]);

  if (loading) return <div>Loading car rental...</div>;
  if (error) return <div>Error: {error}</div>;
  if (!rental) return <div>Car rental not found.</div>;

  return (
    <main>
      <CarRentalDetail rental={rental} />
    </main>
  );
}