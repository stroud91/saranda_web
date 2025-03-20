"use client";

import { SignedIn, SignedOut, RedirectToSignIn } from "@clerk/nextjs";
import HeroSection from "./components/HeroSection";
import TourCard from "./tours/TourCard";
import CarRentalCard from "./car_rentals/CarRentalCard";
import HotelCard from "./hotels/HotelCard";
import { useEffect, useState } from "react";

// Mock API calls (replace with real backend API calls)
async function getTours() {
  return [
    { id: 1, name: "Beach Escape", price: 500, duration: 5, image: "/images/beach-escape.jpg" },
    { id: 2, name: "Mountain Adventure", price: 800, duration: 7, image: "/images/mountain-adventure.jpg" },
    { id: 3, name: "City Lights", price: 300, duration: 3, image: "/images/city-lights.jpg" },
  ];
}

async function getCarRentals() {
  return [
    { id: 1, model: "Toyota Corolla", pricePerDay: 40, image: "/images/toyota-corolla.jpg" },
    { id: 2, model: "Tesla Model 3", pricePerDay: 100, image: "/images/tesla-model-3.jpg" },
    { id: 3, model: "Jeep Wrangler", pricePerDay: 80, image: "/images/jeep-wrangler.jpg" },
  ];
}

async function getHotels() {
  return [
    { id: 1, name: "Luxury Inn", price: 200, location: "Downtown", image: "/images/luxury-inn.jpg" },
    { id: 2, name: "Seaside Hotel", price: 150, location: "Beachfront", image: "/images/seaside-hotel.jpg" },
    { id: 3, name: "Mountain Lodge", price: 120, location: "Mountains", image: "/images/mountain-lodge.jpg" },
  ];
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
        const [toursData, carRentalsData, hotelsData] = await Promise.all([getTours(), getCarRentals(), getHotels()]);
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
