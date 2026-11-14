import { lazy, Suspense } from "react";
import { Sparkles } from "lucide-react";
import { motion } from "framer-motion";
import { useUi } from "../../store/ui";
import { tr } from "../../i18n";

const ConciergeSheet = lazy(() => import("./ConciergeSheet"));

export default function ConciergeFab() {
  const { conciergeOpen, openConcierge } = useUi();
  return (
    <>
      {!conciergeOpen && (
        <motion.button
          className="fab"
          onClick={() => openConcierge()}
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          whileHover={{ y: -2 }}
          whileTap={{ scale: 0.95 }}
          aria-label={tr("Ask the Saranda concierge")}
        >
          <span className="fab-ping" aria-hidden="true" />
          <span className="fab-orb"><Sparkles size={22} /></span>
          <span className="fab-label">{tr("Ask the concierge")}</span>
        </motion.button>
      )}
      <Suspense fallback={null}>{conciergeOpen && <ConciergeSheet />}</Suspense>
    </>
  );
}
