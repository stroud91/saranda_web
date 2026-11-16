import { lazy } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { MotionConfig } from "framer-motion";
import AppShell from "./components/layout/AppShell";
import Home from "./pages/Home";

const Explore = lazy(() => import("./pages/Explore"));
const Credits = lazy(() => import("./pages/Credits"));
const DestinationDetail = lazy(() => import("./pages/DestinationDetail"));
const RoutesPage = lazy(() => import("./pages/Routes"));
const MapPage = lazy(() => import("./pages/MapPage"));
const Atlas = lazy(() => import("./pages/Atlas"));
const Account = lazy(() => import("./pages/Account"));
const authPage = (name) => lazy(() => import("./pages/Auth").then((m) => ({ default: m[name] })));
const SignIn = authPage("SignIn");
const SignUp = authPage("SignUp");
const ForgotPassword = authPage("ForgotPassword");
const ResetPassword = authPage("ResetPassword");
const VerifyEmail = authPage("VerifyEmail");
const Planner = lazy(() => import("./pages/Planner"));
const Itineraries = lazy(() => import("./pages/Itineraries"));
const ItineraryDetail = lazy(() => import("./pages/ItineraryDetail"));
const Guides = lazy(() => import("./pages/Guides"));
const GuideDetail = lazy(() => import("./pages/GuideDetail"));
const GuideRequestStatus = lazy(() => import("./pages/GuideRequestStatus"));
const Business = lazy(() => import("./pages/Business"));
const PartnerDirectory = lazy(() => import("./pages/Partners").then((m) => ({ default: m.PartnerDirectory })));
const PartnerProfile = lazy(() => import("./pages/Partners").then((m) => ({ default: m.PartnerProfile })));
const Privacy = lazy(() => import("./pages/Legal").then((m) => ({ default: m.Privacy })));
const Terms = lazy(() => import("./pages/Legal").then((m) => ({ default: m.Terms })));
const Stays = lazy(() => import("./pages/Stays"));
const StayDetail = lazy(() => import("./pages/StayDetail"));
const BookingStatus = lazy(() => import("./pages/BookingStatus"));
const ReviewStay = lazy(() => import("./pages/ReviewStay"));
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
            <Route path="/atlas" element={<Atlas />} />
            <Route path="/plan" element={<Planner />} />
            <Route path="/itineraries" element={<Itineraries />} />
            <Route path="/itineraries/:slug" element={<ItineraryDetail />} />
            <Route path="/guides" element={<Guides />} />
            <Route path="/guides/:slug" element={<GuideDetail />} />
            <Route path="/guide-request/:reference" element={<GuideRequestStatus />} />
            <Route path="/business" element={<Business />} />
            <Route path="/partners" element={<PartnerDirectory />} />
            <Route path="/partners/:slug" element={<PartnerProfile />} />
            <Route path="/privacy" element={<Privacy />} />
            <Route path="/terms" element={<Terms />} />
            <Route path="/stays" element={<Stays />} />
            <Route path="/stays/:id" element={<StayDetail />} />
            <Route path="/hotels" element={<Stays />} />
            <Route path="/hotels/:id" element={<StayDetail />} />
            <Route path="/booking/:reference" element={<BookingStatus />} />
            <Route path="/review/:reference" element={<ReviewStay />} />
            <Route path="/essentials" element={<Essentials />} />
            <Route path="/experiences" element={<Experiences />} />
            <Route path="/tours" element={<Experiences />} />
            <Route path="/trip/:shareId" element={<TripShare />} />
            <Route path="/contact" element={<Contact />} />
            <Route path="/about-us" element={<Contact />} />
            <Route path="/credits" element={<Credits />} />
            <Route path="/signin" element={<SignIn />} />
            <Route path="/signup" element={<SignUp />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/verify-email" element={<VerifyEmail />} />
            <Route path="/account" element={<Account />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AppShell>
      </BrowserRouter>
    </MotionConfig>
  );
}
