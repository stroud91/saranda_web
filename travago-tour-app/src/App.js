import React, { useState, useEffect } from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "styled-components";
import { GlobalStyles } from "./GlobalStyles";
import { dayTheme, nightTheme } from "./theme";

// Import your components (adjust paths if needed)
import Navbar from "./components/mainpage/Navbar";
import HeroSection from "./components/mainpage/HeroSection";
import Footer from "./components/mainpage/Footer";

// Import feature pages – these are examples; replace with your actual pages
import HotelListPage from "./components/hotels/HotelListPage";
import HotelDetailPage from "./components/hotels/HotelDetailPage";
import TourListPage from "./components/tours/TourListPage";
import TourDetailPage from "./components/tours/TourDetailPage";
import CarRentalListPage from "./components/carRentals/CarRentalListPage";
import CarRentalDetailPage from "./components/carRentals/CarRentalDetailPage";

function App() {
  const [isNightMode, setIsNightMode] = useState(false);

  const toggleTheme = () => {
    setIsNightMode(prev => !prev);
  };

  // Optionally, update the body class for global CSS fallback
  useEffect(() => {
    document.body.className = isNightMode ? "black-gold" : "coastal";
  }, [isNightMode]);

  return (
    <ThemeProvider theme={isNightMode ? nightTheme : dayTheme}>
      <GlobalStyles />
      <Router>
        <Navbar isNightMode={isNightMode} toggleTheme={toggleTheme} />
        <Routes>
          <Route path="/" element={<HeroSection />} />
          <Route path="/tours" element={<TourListPage />} />
          <Route path="/tours/:id" element={<TourDetailPage />} />
          <Route path="/hotels" element={<HotelListPage />} />
          <Route path="/hotels/:id" element={<HotelDetailPage />} />
          <Route path="/car-rentals" element={<CarRentalListPage />} />
          <Route path="/car-rentals/:id" element={<CarRentalDetailPage />} />
        </Routes>
        <Footer />
      </Router>
    </ThemeProvider>
  );
}

export default App;