import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import HotelDetail from './HotelDetail';

const baseUrl = process.env.REACT_APP_BASE_URL || 'http://localhost:5000';

export default function HotelDetailPage() {
  const { id } = useParams();
  const [hotel, setHotel] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function fetchHotel() {
      try {
        const res = await fetch(`${baseUrl}/api/hotels/${id}`);
        if (!res.ok) {
          throw new Error('Failed to fetch hotel');
        }
        const data = await res.json();
        setHotel(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    fetchHotel();
  }, [id]);

  if (loading) return <div>Loading hotel...</div>;
  if (error) return <div>Error: {error}</div>;
  if (!hotel) return <div>Hotel not found.</div>;

  return (
    <main>
      <HotelDetail hotel={hotel} />
    </main>
  );
}