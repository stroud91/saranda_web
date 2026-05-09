import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import styled from "styled-components";
import HotelDetail from "./HotelDetail";

const LoadingMsg = styled.div`
  padding: 120px 24px;
  text-align: center;
  color: ${({ theme }) => theme.colors.textMuted};
  font-size: 1.1rem;
`;

export default function HotelDetailPage() {
  const { id } = useParams();
  const [hotel, setHotel] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch(`/api/hotels/${id}`)
      .then((r) => {
        if (!r.ok) throw new Error("Apartment not found");
        return r.json();
      })
      .then(setHotel)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <LoadingMsg>Loading apartment…</LoadingMsg>;
  if (error) return <LoadingMsg>Error: {error}</LoadingMsg>;
  if (!hotel) return <LoadingMsg>Apartment not found.</LoadingMsg>;

  return <HotelDetail hotel={hotel} />;
}
