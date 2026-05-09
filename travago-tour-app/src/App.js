import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "styled-components";
import { GlobalStyles } from "./GlobalStyles";
import { megTheme } from "./theme";

import Navbar from "./components/mainpage/Navbar";
import Footer from "./components/mainpage/Footer";
import WhatsAppButton from "./components/mainpage/WhatsAppButton";

import HomePage from "./components/mainpage/HomePage";
import ContactPage from "./components/mainpage/ContactPage";
import AboutPage from "./components/mainpage/AboutPage";

import HotelListPage from "./components/hotels/HotelListPage";
import HotelDetailPage from "./components/hotels/HotelDetailPage";

import TourListPage from "./components/tours/TourListPage";
import TourDetailPage from "./components/tours/TourDetailPage";

import CarRentalListPage from "./components/carRentals/CarRentalListPage";
import CarRentalDetailPage from "./components/carRentals/CarRentalDetailPage";

import BookingPage from "./components/booking/BookingPage";
import BookingConfirmation from "./components/booking/BookingConfirmation";

function App() {
  return (
    <ThemeProvider theme={megTheme}>
      <GlobalStyles />
      <Router>
        <Navbar />
        <Routes>
          <Route path="/" element={<HomePage />} />

          {/* Apartments */}
          <Route path="/hotels" element={<HotelListPage />} />
          <Route path="/hotels/:id" element={<HotelDetailPage />} />
          <Route path="/hotels/:id/book" element={<BookingPage />} />

          {/* Tours */}
          <Route path="/tours" element={<TourListPage />} />
          <Route path="/tours/:id" element={<TourDetailPage />} />

          {/* Car Rentals */}
          <Route path="/car-rentals" element={<CarRentalListPage />} />
          <Route path="/car-rentals/:id" element={<CarRentalDetailPage />} />

          {/* Booking confirmation */}
          <Route path="/booking/confirmation/:id" element={<BookingConfirmation />} />

          {/* Info pages */}
          <Route path="/contact" element={<ContactPage />} />
          <Route path="/about-us" element={<AboutPage />} />
        </Routes>
        <Footer />
        <WhatsAppButton />
      </Router>
    </ThemeProvider>
  );
}

export default App;
