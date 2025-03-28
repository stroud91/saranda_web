export async function generateStaticParams() {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:5000';

  try {
    const res = await fetch(`${baseUrl}/api/hotels`, { cache: 'force-cache' });
    if (!res.ok) {
      throw new Error('Failed to fetch hotels');
    }
    const hotels = await res.json();

    // Return an array of objects like [{ id: '1' }, { id: '2' }, ...]
    return hotels.map((hotel) => ({ id: String(hotel.id) }));
  } catch (error) {
    console.error('Error in generateStaticParams:', error);
    // Return an empty array if fetch fails, so no pages get generated
    return [];
  }
}

import HotelDetail from '../HotelDetail';

export default async function HotelDetailPage({ params }) {
  const { id } = params;
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:5000';

  // For static export, prefer `cache: 'force-cache'` or the default (no 'no-store')
  const res = await fetch(`${baseUrl}/api/hotels/${id}`, { cache: 'force-cache' });

  if (!res.ok) {
    return <div>Failed to load hotel.</div>;
  }

  const hotel = await res.json();

  return (
    <main>
      <HotelDetail hotel={hotel} />
    </main>
  );
}