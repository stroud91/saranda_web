import CarRentalList from './CarRentalList';

export default async function CarRentalsPage() {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:5000';

  const res = await fetch(`${baseUrl}/api/car_rentals`, { cache: 'force-cache' });
  if (!res.ok) {
    return <div>Failed to load car rentals.</div>;
  }

  // Assuming the API returns: { car_rentals: [...] }
  const data = await res.json();
  const rentals = data.car_rentals || [];

  return (
    <main>
      <h1>All Car Rentals</h1>
      <CarRentalList rentals={rentals} />
    </main>
  );
}