import { cloneElement, lazy, Suspense, useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import TopBar from "./TopBar";
import TabBar from "./TabBar";
import Footer from "./Footer";
import ConciergeFab from "../concierge/ConciergeFab";
import { ToastHost } from "../ui";
import { useUi } from "../../store/ui";
import Interactions from "../fx/Interactions";
import { useAuth } from "../../store/auth";
import { useConfig } from "../../lib/useConfig";
import { countView } from "../../lib/hits";
import { tr } from "../../i18n";

const CommandPalette = lazy(() => import("../fx/CommandPalette"));

/** Ctrl/⌘+K anywhere, or "/" when not typing, opens the search palette. */
function usePaletteKeys() {
  const openPalette = useUi((s) => s.openPalette);
  useEffect(() => {
    const onKey = (e) => {
      const typing = e.target instanceof Element && e.target.closest("input, textarea, select, [contenteditable='true']");
      if ((e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        openPalette();
      } else if (e.key === "/" && !typing && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        openPalette();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openPalette]);
}

function useTheme() {
  const theme = useUi((s) => s.theme);
  useEffect(() => {
    const root = document.documentElement;
    if (theme === "system") root.removeAttribute("data-theme");
    else root.setAttribute("data-theme", theme);
  }, [theme]);
}

/**
 * Keeps a page wrapper showing the route it was created for.
 *
 * While the old page fades out, the router already reports the new address.
 * Without this the old wrapper would render the new page for a moment, and the
 * page would then be mounted a second time in its own wrapper — running its
 * requests twice and wiping anything typed (or autofilled) in between.
 * Query-string and hash changes on the same page still come through.
 */
function RouteFreeze({ pathname, children }) {
  const location = useLocation();
  const shown = useRef(location);
  if (location.pathname === pathname) shown.current = location;
  return cloneElement(children, { location: shown.current });
}

const FULLSCREEN = ["/map", "/atlas"];
// Sign-in pages fill the screen with their own layout (no footer).
const BARE = ["/signin", "/signup", "/forgot-password", "/reset-password", "/verify-email"];

export default function AppShell({ children }) {
  const location = useLocation();
  useTheme();
  usePaletteKeys();
  const loadAuth = useAuth((s) => s.load);
  useEffect(() => { loadAuth(); }, [loadAuth]);
  // Visitor statistics for the host: one cookie-less count per page opened (see lib/hits.js).
  const statsOn = useConfig().stats === true;
  useEffect(() => { if (statsOn) countView(location.pathname); }, [statsOn, location.pathname]);
  const paletteOpen = useUi((s) => s.paletteOpen);
  const closePalette = useUi((s) => s.closePalette);
  useEffect(() => {
    if (!location.hash) window.scrollTo({ top: 0, behavior: "instant" });
    else document.getElementById(location.hash.slice(1))?.scrollIntoView({ behavior: "smooth" });
  }, [location.pathname, location.hash]);
  const full = FULLSCREEN.includes(location.pathname) || BARE.includes(location.pathname);
  return (
    <>
      <a href="#main" className="skip-link">{tr("Skip to content")}</a>
      <TopBar />
      <AnimatePresence mode="wait">
        <motion.main
          id="main"
          key={location.pathname}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
        >
          <Suspense fallback={<div className="page container"><div className="skeleton" style={{ height: 320, marginTop: 40 }} /></div>}>
            <RouteFreeze pathname={location.pathname}>{children}</RouteFreeze>
          </Suspense>
        </motion.main>
      </AnimatePresence>
      {!full && <Footer />}
      <TabBar />
      <ConciergeFab />
      <ToastHost />
      <Interactions />
      {paletteOpen && (
        <Suspense fallback={null}>
          <CommandPalette open={paletteOpen} onClose={closePalette} />
        </Suspense>
      )}
    </>
  );
}
