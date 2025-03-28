import HotelList from './HotelList';

export default async function HotelsPage() {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:5000';

  const res = await fetch(`${baseUrl}/api/hotels`, { cache: 'force-cache' });
  if (!res.ok) {
    return <div>Failed to load hotels.</div>;
  }

  const hotels = await res.json();

  return (
    <main>
      <h1>All Hotels</h1>
      <HotelList hotels={hotels} />
    </main>
  );
}