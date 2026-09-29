import { lazy } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { MotionConfig } from "framer-motion";
import AppShell from "./components/layout/AppShell";
import Home from "./pages/Home";

const Explore = lazy(() => import("./pages/Explore"));
const DestinationDetail = lazy(() => import("./pages/DestinationDetail"));
const RoutesPage = lazy(() => import("./pages/Routes"));
const MapPage = lazy(() => import("./pages/MapPage"));
const Planner = lazy(() => import("./pages/Planner"));
const Itineraries = lazy(() => import("./pages/Itineraries"));
const ItineraryDetail = lazy(() => import("./pages/ItineraryDetail"));
const Guides = lazy(() => import("./pages/Guides"));
const GuideDetail = lazy(() => import("./pages/GuideDetail"));
const GuideRequestStatus = lazy(() => import("./pages/GuideRequestStatus"));
const Stays = lazy(() => import("./pages/Stays"));
const StayDetail = lazy(() => import("./pages/StayDetail"));
const BookingStatus = lazy(() => import("./pages/BookingStatus"));
const Essentials = lazy(() => import("./pages/Essentials"));
const Experiences = lazy(() => import("./pages/Experiences"));
const TripShare = lazy(() => import("./pages/TripShare"));
const Contact = lazy(() => import("./pages/Contact"));
const NotFound = lazy(() => import("./pages/NotFound"));

export default function App() {
  return (
    <MotionConfig reducedMotion="user">
      <BrowserRouter>
        <AppShell>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/explore" element={<Explore />} />
            <Route path="/explore/:slug" element={<DestinationDetail />} />
            <Route path="/routes" element={<RoutesPage />} />
            <Route path="/map" element={<MapPage />} />
            <Route path="/plan" element={<Planner />} />
            <Route path="/itineraries" element={<Itineraries />} />
            <Route path="/itineraries/:slug" element={<ItineraryDetail />} />
            <Route path="/guides" element={<Guides />} />
            <Route path="/guides/:slug" element={<GuideDetail />} />
            <Route path="/guide-request/:reference" element={<GuideRequestStatus />} />
            <Route path="/stays" element={<Stays />} />
            <Route path="/stays/:id" element={<StayDetail />} />
            <Route path="/hotels" element={<Stays />} />
            <Route path="/hotels/:id" element={<StayDetail />} />
            <Route path="/booking/:reference" element={<BookingStatus />} />
            <Route path="/essentials" element={<Essentials />} />
            <Route path="/experiences" element={<Experiences />} />
            <Route path="/tours" element={<Experiences />} />
            <Route path="/trip/:shareId" element={<TripShare />} />
            <Route path="/contact" element={<Contact />} />
            <Route path="/about-us" element={<Contact />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AppShell>
      </BrowserRouter>
    </MotionConfig>
  );
}
