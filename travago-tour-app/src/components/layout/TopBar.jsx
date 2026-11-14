import { useEffect, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { Box, Compass, Map, CalendarRange, Route, Users, BedDouble, BookOpen, Search, UserRound } from "lucide-react";
import Logo from "../art/Logo";
import { useUi } from "../../store/ui";
import { useAuth } from "../../store/auth";
import { useGuidesOn } from "../../lib/useConfig";
import Preferences from "./Preferences";
import { tr } from "../../i18n";

export const NAV = [
  { to: "/explore", label: "Explore", icon: Compass },
  { to: "/plan", label: "Plan", icon: CalendarRange },
  { to: "/routes", label: "Routes", icon: Route },
  { to: "/map", label: "Map", icon: Map },
  { to: "/atlas", label: "3D", icon: Box },
  { to: "/guides", label: "Guides", icon: Users },
  { to: "/stays", label: "Stays", icon: BedDouble },
  { to: "/essentials", label: "Essentials", icon: BookOpen },
];

const HERO_PAGES = ["/"];

export default function TopBar() {
  const { pathname } = useLocation();
  const [scrolled, setScrolled] = useState(false);
  const openPalette = useUi((s) => s.openPalette);
  const user = useAuth((s) => s.user);
  const accounts = useAuth((s) => s.available);
  const guides = useGuidesOn();
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [pathname]);
  return (
    <header className={`topbar ${HERO_PAGES.includes(pathname) ? "on-hero" : ""} ${scrolled ? "scrolled" : ""}`}>
      <div className="topbar-inner">
        <Link to="/" className="brand" aria-label={tr("Saranda Companion home")}>
          <Logo />
          <span>
            Saranda
            <small>Companion · Meg'Rooms</small>
          </span>
        </Link>
        <nav className="nav" aria-label={tr("Main")}>
          {NAV.filter((n) => guides || n.to !== "/guides").map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`}>
              <Icon size={16} />
              {tr(label)}
            </NavLink>
          ))}
        </nav>
        <div className="topbar-actions">
          <button className="icon-btn search-btn" onClick={openPalette} aria-label={tr("Search (Ctrl K)")} title={tr("Search · Ctrl K")}>
            <Search size={19} />
          </button>
          {accounts && (user ? (
            <Link to="/account" className="account-chip" aria-label={`My account (${user.name || user.email})`} title={tr("My account")}>
              <span>{(user.name || user.email)[0].toUpperCase()}</span>
            </Link>
          ) : (
            <Link to="/signin" className="icon-btn" aria-label={tr("Sign in")} title={tr("Sign in")}><UserRound size={19} /></Link>
          ))}
          <Preferences />
        </div>
      </div>
    </header>
  );
}
