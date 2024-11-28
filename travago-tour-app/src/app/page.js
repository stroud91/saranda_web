import HeroSection from '../components/HeroSection';
import TourCard from '../components/TourCard';
import CarRentalCard from '../components/CarRentalCard';
import HotelCard from '../components/HotelCard';
import { getTours, getCarRentals, getHotels } from '../utils/api';
import { useEffect, useState } from 'react';

export default function Home() {
  const [tours, setTours] = useState([]);
  const [carRentals, setCarRentals] = useState([]);
  const [hotels, setHotels] = useState([]);

  useEffect(() => {
    async function fetchData() {
      const toursData = await getTours();
      const carRentalsData = await getCarRentals();
      const hotelsData = await getHotels();
      setTours(toursData);
      setCarRentals(carRentalsData);
      setHotels(hotelsData);
    }
    fetchData();
  }, []);

  return (
    <main>
      <HeroSection />
      <section className="container">
        <h2>Explore Tours</h2>
        <div className="grid grid-3">
          {tours.map((tour) => (
            <TourCard key={tour.id} tour={tour} />
          ))}
        </div>
      </section>
      <section className="container">
        <h2>Car Rentals</h2>
        <div className="grid grid-3">
          {carRentals.map((car) => (
            <CarRentalCard key={car.id} car={car} />
          ))}
        </div>
      </section>
      <section className="container">
        <h2>Hotels</h2>
        <div className="grid grid-3">
          {hotels.map((hotel) => (
            <HotelCard key={hotel.id} hotel={hotel} />
          ))}
        </div>
      </section>
    </main>
  );
}
