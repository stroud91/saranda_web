import { Link } from "react-router-dom";
import { useConfig, useGuidesOn, usePartnersOn, whatsappUrl } from "../../lib/useConfig";

export default function Footer() {
  const cfg = useConfig();
  const guides = useGuidesOn();
  const partners = usePartnersOn();
  const wa = whatsappUrl(cfg.whatsapp, "Hello Meg'Rooms! I'm planning a trip to Sarandë.");
  return (
    <footer className="footer">
      <svg className="footer-wave" viewBox="0 0 1440 70" preserveAspectRatio="none" aria-hidden="true">
        <path d="M0 0h1440v28c-120 26-240 38-360 28S840 12 720 18 480 58 360 58 120 40 0 26z" fill="var(--bg)" />
      </svg>
      <div className="container">
        <div className="footer-grid">
          <div>
            <img src="/media/megrooms-logo.png" alt="Meg'Rooms — feels like home" className="footer-logo" width="120" height="120" loading="lazy" />
            <p className="small" style={{ maxWidth: 360, marginTop: 12 }}>
              Your companion for Albania, from our apartments on the Sarandë seafront to the stone cities, mountains and the whole Ionian coast.
            </p>
            {wa && <a className="btn whatsapp sm" href={wa} target="_blank" rel="noopener noreferrer">Chat on WhatsApp</a>}
          </div>
          <div>
            <h4>Plan</h4>
            <ul>
              <li><Link to="/plan">Trip planner</Link></li>
              <li><Link to="/itineraries">Ready-made itineraries</Link></li>
              <li><Link to="/routes">Route connector</Link></li>
              <li><Link to="/map">Interactive map</Link></li>
            </ul>
          </div>
          <div>
            <h4>Discover</h4>
            <ul>
              <li><Link to="/explore">Destinations</Link></li>
              {guides && <li><Link to="/guides">Local guides</Link></li>}
              <li><Link to="/experiences">Experiences & rentals</Link></li>
              {partners && <li><Link to="/partners">Local businesses</Link></li>}
              <li><Link to="/essentials">Know before you go</Link></li>
            </ul>
          </div>
          <div>
            <h4>Meg'Rooms</h4>
            <ul>
              <li><Link to="/stays">Our apartments</Link></li>
              <li><Link to="/contact">Contact</Link></li>
              {partners && <li><Link to="/business">List your business</Link></li>}
              <li><Link to="/essentials#emergency">Emergency numbers</Link></li>
              <li><Link to="/terms">Booking terms</Link></li>
              <li><Link to="/privacy">Privacy policy</Link></li>
            </ul>
          </div>
        </div>
        <div className="footer-bottom">
          <span>© {new Date().getFullYear()} Meg'Rooms · Sarandë, Albania</span>
          <span>Independent travel guide · Prices and times are planning estimates — verify before booking.</span>
          <span>
            Data: <a href="https://open-meteo.com/" target="_blank" rel="noopener noreferrer">Weather data by Open-Meteo.com</a> ·{" "}
            <a href="https://www.exchangerate-api.com" target="_blank" rel="noopener noreferrer">Rates By Exchange Rate API</a> ·{" "}
            Map data © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors ·{" "}
            Routing by <a href="https://project-osrm.org/" target="_blank" rel="noopener noreferrer">OSRM</a> ·{" "}
            <Link to="/credits">Video credits & licences</Link>
          </span>
        </div>
      </div>
    </footer>
  );
}
