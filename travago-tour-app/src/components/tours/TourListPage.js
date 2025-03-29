import React, { useEffect, useState } from 'react';
import TourList from './TourList';

const baseUrl = process.env.REACT_APP_BASE_URL || 'http://localhost:5000';

export default function TourListPage() {
  const [tours, setTours] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function fetchTours() {
      try {
        const res = await fetch(`${baseUrl}/api/tours`);
        if (!res.ok) {
          throw new Error('Failed to fetch tours');
        }
        const data = await res.json();
        setTours(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    fetchTours();
  }, []);

  if (loading) return <div>Loading tours...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <main>
      <h1>All Tours</h1>
      <TourList tours={tours} />
    </main>
  );
}