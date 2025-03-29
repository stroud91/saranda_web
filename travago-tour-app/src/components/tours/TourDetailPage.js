import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import TourDetail from './TourDetail';

const baseUrl = process.env.REACT_APP_BASE_URL || 'http://localhost:5000';

export default function TourDetailPage() {
  const { id } = useParams();
  const [tour, setTour] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function fetchTour() {
      try {
        const res = await fetch(`${baseUrl}/api/tours/${id}`);
        if (!res.ok) {
          throw new Error('Failed to fetch tour');
        }
        const data = await res.json();
        setTour(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    fetchTour();
  }, [id]);

  if (loading) return <div>Loading tour...</div>;
  if (error) return <div>Error: {error}</div>;
  if (!tour) return <div>Tour not found.</div>;

  return (
    <main>
      <TourDetail tour={tour} />
    </main>
  );
}