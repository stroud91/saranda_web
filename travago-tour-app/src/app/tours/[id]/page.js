export async function generateStaticParams() {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:5000';

  try {
    const res = await fetch(`${baseUrl}/api/tours`, { cache: 'force-cache' });
    if (!res.ok) {
      throw new Error('Failed to fetch tours');
    }
    const tours = await res.json();

    // Return an array of objects like [{ id: '1' }, { id: '2' }, ...]
    return tours.map((tour) => ({ id: String(tour.id) }));
  } catch (error) {
    console.error('Error in generateStaticParams:', error);
    // Return an empty array if fetching fails, so no pages get generated
    return [];
  }
}

import TourDetail from '../TourDetail';

export default async function TourDetailPage({ params }) {
  const { id } = params;
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:5000';

  // For static export, prefer `cache: 'force-cache'` or omit it (default static behavior)
  const res = await fetch(`${baseUrl}/api/tours/${id}`, { cache: 'force-cache' });

  if (!res.ok) {
    return <div>Failed to load tour.</div>;
  }

  const tour = await res.json();

  return (
    <main>
      <TourDetail tour={tour} />
    </main>
  );
}