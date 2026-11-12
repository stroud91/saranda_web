import { NavLink } from "react-router-dom";
import { motion } from "framer-motion";
import { Home, Compass, CalendarRange, Map, Users, BedDouble } from "lucide-react";
import { useGuidesOn } from "../../lib/useConfig";

const TABS = [
  { to: "/", label: "Today", icon: Home, end: true },
  { to: "/explore", label: "Explore", icon: Compass },
  { to: "/plan", label: "Plan", icon: CalendarRange },
  { to: "/map", label: "Map", icon: Map },
  { to: "/guides", label: "Guides", icon: Users },
];
// Until there are real guides the last tab goes to the apartments instead.
const STAYS_TAB = { to: "/stays", label: "Stays", icon: BedDouble };

export default function TabBar() {
  const guides = useGuidesOn();
  const tabs = guides ? TABS : [...TABS.slice(0, -1), STAYS_TAB];
  return (
    <nav className="tabbar" aria-label="App">
      {tabs.map(({ to, label, icon: Icon, end }) => (
        <NavLink key={to} to={to} end={end} className={({ isActive }) => `tab ${isActive ? "active" : ""}`}>
          {({ isActive }) => (
            <>
              {isActive && <motion.span layoutId="tab-pill" className="tab-pill" transition={{ type: "spring", damping: 30, stiffness: 400 }} />}
              <Icon size={22} strokeWidth={isActive ? 2.4 : 2} />
              <span>{label}</span>
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
}
