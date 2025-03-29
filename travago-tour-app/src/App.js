import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';

// Import pages from your features (or components folder)
import HotelListPage from './components/hotels/HotelListPage';
import HotelDetailPage from './components/hotels/HotelDetailPage';
import TourListPage from './components/tours/TourListPage';
import TourDetailPage from './components/tours/TourDetailPage';
import CarRentalListPage from './components/carRentals/CarRentalListPage';
import CarRentalDetailPage from './components/carRentals/CarRentalDetailPage';

// Import common components
import Navbar from './components/mainpage/Navbar';
import HeroSection from './components/mainpage/HeroSection';
import Footer from './components/mainpage/Footer';

function App() {
  return (
    <Router>
      <Navbar />
      <HeroSection />
      <Routes>
        {/* Home Route */}
        <Route path="/"  />

        {/* Hotels Routes */}
        <Route path="/hotels" element={<HotelListPage />} />
        <Route path="/hotels/:id" element={<HotelDetailPage />} />

        {/* Tours Routes */}
        <Route path="/tours" element={<TourListPage />} />
        <Route path="/tours/:id" element={<TourDetailPage />} />

        {/* Car Rentals Routes */}
        <Route path="/carRentals" element={<CarRentalListPage />} />
        <Route path="/carRentals/:id" element={<CarRentalDetailPage />} />
        
        {/* Add any additional routes here */}
      </Routes>
      <Footer />
    </Router>
  );
}

export default App;