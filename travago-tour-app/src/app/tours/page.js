import TourList from './TourList';

export default async function ToursPage() {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:5000';

  // For static generation, use default caching or 'force-cache'
  const res = await fetch(`${baseUrl}/api/tours`, { cache: 'force-cache' });
  if (!res.ok) {
    return <div>Failed to load tours.</div>;
  }

  const tours = await res.json();

  return (
    <main>
      <h1>All Tours</h1>
      <TourList tours={tours} />
    </main>
  );
}
