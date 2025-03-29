import React, { useEffect, useState } from 'react';
import HotelList from './HotelList';

const baseUrl = process.env.REACT_APP_BASE_URL || 'http://localhost:5000';

export default function HotelListPage() {
  const [hotels, setHotels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function fetchHotels() {
      try {
        const res = await fetch(`${baseUrl}/api/hotels`);
        if (!res.ok) {
          throw new Error('Failed to fetch hotels');
        }
        const data = await res.json();
        setHotels(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    fetchHotels();
  }, []);

  if (loading) return <div>Loading hotels...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <main>
      <h1>All Hotels</h1>
      <HotelList hotels={hotels} />
    </main>
  );
}