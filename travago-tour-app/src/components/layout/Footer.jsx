import { Link } from "react-router-dom";
import { useConfig, useGuidesOn, usePartnersOn, whatsappUrl } from "../../lib/useConfig";
import { LANGS, currentLang } from "../../i18n";
import { useUi } from "../../store/ui";
import { tr } from "../../i18n";

export default function Footer() {
  const cfg = useConfig();
  const guides = useGuidesOn();
  const partners = usePartnersOn();
  const setLang = useUi((s) => s.setLang);
  const wa = whatsappUrl(cfg.whatsapp, "Hello Meg'Rooms! I'm planning a trip to Sarandë.");
  return (
    <footer className="footer">
      <svg className="footer-wave" viewBox="0 0 1440 70" preserveAspectRatio="none" aria-hidden="true">
        <path d="M0 0h1440v28c-120 26-240 38-360 28S840 12 720 18 480 58 360 58 120 40 0 26z" fill="var(--bg)" />
      </svg>
      <div className="container">
        <div className="footer-grid">
          <div>
            <img src="/media/megrooms-logo.png" alt={tr("Meg'Rooms — feels like home")} className="footer-logo" width="120" height="120" loading="lazy" />
            <p className="small" style={{ maxWidth: 360, marginTop: 12 }}>
              {tr("Your companion for Albania, from our apartments on the Sarandë seafront to the stone cities, mountains and the whole Ionian coast.")}
            </p>
            {wa && <a className="btn whatsapp sm" href={wa} target="_blank" rel="noopener noreferrer">{tr("Chat on WhatsApp")}</a>}
          </div>
          <div>
            <h4>{tr("Plan")}</h4>
            <ul>
              <li><Link to="/plan">{tr("Trip planner")}</Link></li>
              <li><Link to="/itineraries">{tr("Ready-made itineraries")}</Link></li>
              <li><Link to="/routes">{tr("Route connector")}</Link></li>
              <li><Link to="/map">{tr("Interactive map")}</Link></li>
            </ul>
          </div>
          <div>
            <h4>{tr("Discover")}</h4>
            <ul>
              <li><Link to="/explore">{tr("Destinations")}</Link></li>
              {guides && <li><Link to="/guides">{tr("Local guides")}</Link></li>}
              <li><Link to="/experiences">{tr("Experiences & rentals")}</Link></li>
              {partners && <li><Link to="/partners">{tr("Local businesses")}</Link></li>}
              <li><Link to="/essentials">{tr("Know before you go")}</Link></li>
            </ul>
          </div>
          <div>
            <h4>{tr("Meg'Rooms")}</h4>
            <ul>
              <li><Link to="/stays">{tr("Our apartments")}</Link></li>
              <li><Link to="/contact">{tr("Contact")}</Link></li>
              {partners && <li><Link to="/business">{tr("List your business")}</Link></li>}
              <li><Link to="/essentials#emergency">{tr("Emergency numbers")}</Link></li>
              <li><Link to="/terms">{tr("Booking terms")}</Link></li>
              <li><Link to="/privacy">{tr("Privacy policy")}</Link></li>
            </ul>
          </div>
        </div>
        <div className="footer-langs" role="group" aria-label={tr("Language")}>
          {LANGS.map((l) => (
            <button key={l.code} type="button" lang={l.code} className={currentLang() === l.code ? "on" : ""} aria-pressed={currentLang() === l.code} onClick={() => setLang(l.code)}>{l.name}</button>
          ))}
        </div>
        <div className="footer-bottom">
          <span>© {new Date().getFullYear()} Meg'Rooms · Sarandë, Albania</span>
          <span>{tr("Independent travel guide · Prices and times are planning estimates — verify before booking.")}</span>
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
