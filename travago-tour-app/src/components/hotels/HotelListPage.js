import React, { useEffect, useState } from "react";
import styled from "styled-components";
import HotelCard from "./HotelCard";

const PageHeader = styled.div`
  background: ${({ theme }) => theme.colors.primary};
  padding: 120px 24px 48px;
  text-align: center;
`;

const PageTitle = styled.h1`
  font-family: ${({ theme }) => theme.fonts.display};
  font-size: 2.5rem;
  font-weight: 700;
  color: #fff;
  margin-bottom: 8px;
`;

const PageSubtitle = styled.p`
  color: rgba(255, 255, 255, 0.75);
  font-size: 1.05rem;
`;

const FilterBar = styled.div`
  background: ${({ theme }) => theme.colors.surface};
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};
  padding: 16px 24px;
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
  position: sticky;
  top: 70px;
  z-index: 100;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
`;

const FilterLabel = styled.label`
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.9rem;
  color: ${({ theme }) => theme.colors.text};
  font-weight: 500;
`;

const Select = styled.select`
  padding: 6px 10px;
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radius.sm};
  font-size: 0.88rem;
  background: ${({ theme }) => theme.colors.background};
  color: ${({ theme }) => theme.colors.text};
  cursor: pointer;

  &:focus {
    outline: none;
    border-color: ${({ theme }) => theme.colors.primary};
  }
`;

const ResultCount = styled.span`
  margin-left: auto;
  font-size: 0.85rem;
  color: ${({ theme }) => theme.colors.textMuted};
`;

const Content = styled.main`
  max-width: 1200px;
  margin: 0 auto;
  padding: 40px 24px;
`;

const Grid = styled.div`
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 24px;

  @media (max-width: 960px) {
    grid-template-columns: repeat(2, 1fr);
  }

  @media (max-width: 600px) {
    grid-template-columns: 1fr;
  }
`;

const StatusMsg = styled.div`
  text-align: center;
  padding: 80px 24px;
  color: ${({ theme }) => theme.colors.textMuted};
  font-size: 1.05rem;
`;

export default function HotelListPage() {
  const [apartments, setApartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters
  const [guestsFilter, setGuestsFilter] = useState("any");
  const [bedroomsFilter, setBedroomsFilter] = useState("any");
  const [priceFilter, setPriceFilter] = useState("any");

  useEffect(() => {
    fetch("/api/hotels")
      .then((r) => {
        if (!r.ok) throw new Error("Failed to load apartments");
        return r.json();
      })
      .then(setApartments)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const filtered = apartments.filter((a) => {
    if (guestsFilter !== "any") {
      const [min, max] = guestsFilter.split("-").map(Number);
      if (a.max_guests < min || (max && a.max_guests > max)) return false;
    }
    if (bedroomsFilter !== "any" && a.bedrooms !== Number(bedroomsFilter))
      return false;
    if (priceFilter !== "any") {
      const price = Number(a.price_per_night);
      if (priceFilter === "u50" && price >= 50) return false;
      if (priceFilter === "50-80" && (price < 50 || price > 80)) return false;
      if (priceFilter === "80plus" && price <= 80) return false;
    }
    return true;
  });

  return (
    <>
      <PageHeader>
        <PageTitle>Our Apartments</PageTitle>
        <PageSubtitle>
          Beachfront units on the Albanian Riviera — Sarandë, Albania
        </PageSubtitle>
      </PageHeader>

      <FilterBar>
        <FilterLabel>
          Guests
          <Select
            value={guestsFilter}
            onChange={(e) => setGuestsFilter(e.target.value)}
          >
            <option value="any">Any</option>
            <option value="1-2">1–2</option>
            <option value="3-4">3–4</option>
            <option value="5-6">5–6</option>
          </Select>
        </FilterLabel>

        <FilterLabel>
          Bedrooms
          <Select
            value={bedroomsFilter}
            onChange={(e) => setBedroomsFilter(e.target.value)}
          >
            <option value="any">Any</option>
            <option value="1">1 bedroom</option>
            <option value="2">2 bedrooms</option>
            <option value="3">3 bedrooms</option>
          </Select>
        </FilterLabel>

        <FilterLabel>
          Price
          <Select
            value={priceFilter}
            onChange={(e) => setPriceFilter(e.target.value)}
          >
            <option value="any">Any</option>
            <option value="u50">Under €50</option>
            <option value="50-80">€50 – €80</option>
            <option value="80plus">€80+</option>
          </Select>
        </FilterLabel>

        <ResultCount>
          {filtered.length} apartment{filtered.length !== 1 ? "s" : ""} found
        </ResultCount>
      </FilterBar>

      <Content>
        {loading && <StatusMsg>Loading apartments…</StatusMsg>}
        {error && <StatusMsg>Error: {error}</StatusMsg>}
        {!loading && !error && filtered.length === 0 && (
          <StatusMsg>No apartments match your filters.</StatusMsg>
        )}
        {!loading && !error && filtered.length > 0 && (
          <Grid>
            {filtered.map((apt) => (
              <HotelCard key={apt.id} hotel={apt} />
            ))}
          </Grid>
        )}
      </Content>
    </>
  );
}
