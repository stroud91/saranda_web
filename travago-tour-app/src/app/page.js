"use client";

import { SignedIn, SignedOut } from "@clerk/nextjs";
import HeroSection from "./components/HeroSection";
import TourCard from "./tours/TourCard";
import CarRentalCard from "./car_rentals/CarRentalCard";
import HotelCard from "./hotels/HotelCard";
import { useEffect, useState } from "react";

// Use the environment variable for the base URL of your Flask API
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL;

async function getTours() {
  const res = await fetch(`${BASE_URL}/api/tours/`);
  if (!res.ok) throw new Error("Failed to fetch tours");
  return await res.json();
}

async function getCarRentals() {
  const res = await fetch(`${BASE_URL}/api/car_rentals/`);
  if (!res.ok) throw new Error("Failed to fetch car rentals");
  const data = await res.json();
  return data.car_rentals;
}

async function getHotels() {
  const res = await fetch(`${BASE_URL}/api/hotels/`);
  if (!res.ok) throw new Error("Failed to fetch hotels");
  return await res.json();
}

export default function Home() {
  const [tours, setTours] = useState([]);
  const [carRentals, setCarRentals] = useState([]);
  const [hotels, setHotels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        const [toursData, carRentalsData, hotelsData] = await Promise.all([
          getTours(),
          getCarRentals(),
          getHotels(),
        ]);
        setTours(toursData);
        setCarRentals(carRentalsData);
        setHotels(hotelsData);
      } catch (err) {
        console.error(err);
        setError("Failed to fetch data. Please try again later.");
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  return (
    <main>
      <HeroSection />
      <SignedIn>
        {loading ? (
          <div className="loading-container">
            <p>Loading content...</p>
          </div>
        ) : error ? (
          <div className="error-container">
            <p>{error}</p>
          </div>
        ) : (
          <>
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
          </>
        )}
      </SignedIn>
      {/* <SignedOut>
        <div className="signed-out-container">
          <h2>Please Sign In</h2>
          <p>Sign in to explore our exciting tours, car rentals, and hotels!</p>
        </div>
      </SignedOut> */}
    </main>
  );
}
