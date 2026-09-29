import { Suspense, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import TopBar from "./TopBar";
import TabBar from "./TabBar";
import Footer from "./Footer";
import ConciergeFab from "../concierge/ConciergeFab";
import { ToastHost } from "../ui";
import { useUi } from "../../store/ui";

function useTheme() {
  const theme = useUi((s) => s.theme);
  useEffect(() => {
    const root = document.documentElement;
    if (theme === "system") root.removeAttribute("data-theme");
    else root.setAttribute("data-theme", theme);
  }, [theme]);
}

const FULLSCREEN = ["/map"];

export default function AppShell({ children }) {
  const location = useLocation();
  useTheme();
  useEffect(() => {
    if (!location.hash) window.scrollTo({ top: 0, behavior: "instant" });
    else document.getElementById(location.hash.slice(1))?.scrollIntoView({ behavior: "smooth" });
  }, [location.pathname, location.hash]);
  const full = FULLSCREEN.includes(location.pathname);
  return (
    <>
      <a href="#main" className="skip-link">Skip to content</a>
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
            {children}
          </Suspense>
        </motion.main>
      </AnimatePresence>
      {!full && <Footer />}
      <TabBar />
      <ConciergeFab />
      <ToastHost />
    </>
  );
}
