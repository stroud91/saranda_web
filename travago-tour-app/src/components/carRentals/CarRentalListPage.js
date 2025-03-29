import React, { useEffect, useState } from 'react';
import CarRentalList from './CarRentalList';

const baseUrl = process.env.REACT_APP_BASE_URL || 'http://localhost:5000';

export default function CarRentalListPage() {
  const [rentals, setRentals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function fetchRentals() {
      try {
        const res = await fetch(`${baseUrl}/api/car_rentals`);
        if (!res.ok) {
          throw new Error('Failed to fetch car rentals');
        }
        const data = await res.json();
        // Assuming your API returns an object with a "car_rentals" property.
        setRentals(data.car_rentals || []);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    fetchRentals();
  }, []);

  if (loading) return <div>Loading car rentals...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <main>
      <h1>All Car Rentals</h1>
      <CarRentalList rentals={rentals} />
    </main>
  );
}