export async function generateStaticParams() {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:5000';
  
  try {
    const res = await fetch(`${baseUrl}/api/car_rentals`, { cache: 'force-cache' });
    if (!res.ok) {
      throw new Error('Failed to fetch car rentals');
    }
    // Assume the API returns an object: { car_rentals: [...] }
    const data = await res.json();
    const rentals = data.car_rentals || [];

    // Return an array of objects like [{ id: '1' }, { id: '2' }, ...]
    return rentals.map((rental) => ({ id: String(rental.id) }));
  } catch (error) {
    console.error('Error in generateStaticParams:', error);
    // Return an empty array if fetching fails, so no pages get generated
    return [];
  }
}

import CarRentalDetail from '../CarRentalDetail';

export default async function CarRentalDetailPage({ params }) {
  const { id } = params;
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:5000';

  // Use static caching for export
  const res = await fetch(`${baseUrl}/api/car_rentals/${id}`, { cache: 'force-cache' });
  if (!res.ok) {
    return <div>Failed to load car rental.</div>;
  }

  const rental = await res.json();

  return (
    <main>
      <CarRentalDetail rental={rental} />
    </main>
  );
}