import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { X, AlertTriangle, Info, CheckCircle2 } from "lucide-react";
import {
  Landmark, Waves, Trees, Building2, Home, Mountain, Sailboat, Wine, Plane, Car, Ship, MapPin,
} from "lucide-react";

export const CATEGORY_META = {
  beach: { icon: Waves, color: "#19c3c0", label: "Beach" },
  history: { icon: Landmark, color: "#d9653b", label: "History" },
  nature: { icon: Trees, color: "#6e7f3a", label: "Nature" },
  city: { icon: Building2, color: "#0b5c7e", label: "City" },
  village: { icon: Home, color: "#a5937a", label: "Village" },
  viewpoint: { icon: Mountain, color: "#d63c7a", label: "Viewpoint" },
  boat: { icon: Sailboat, color: "#0e8fb0", label: "Boat-only" },
  food: { icon: Wine, color: "#8e3b5f", label: "Food & wine" },
  hub: { icon: Plane, color: "#3b4d57", label: "Hub" },
};

export const MODE_META = {
  drive: { icon: Car, label: "Drive", color: "#0b5c7e" },
  ferry: { icon: Ship, label: "Ferry", color: "#d63c7a" },
  boat: { icon: Sailboat, label: "Boat", color: "#19c3c0" },
};

export function CategoryIcon({ category, size = 16 }) {
  const Icon = (CATEGORY_META[category] || { icon: MapPin }).icon;
  return <Icon size={size} />;
}

export function Sheet({ open, onClose, title, children, variant = "side", footer }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);
  const desktop = typeof window !== "undefined" && window.matchMedia("(min-width: 900px)").matches;
  const from = desktop ? (variant === "side" ? { x: 40, opacity: 0 } : { scale: 0.96, opacity: 0 }) : { y: "100%" };
  const to = desktop ? { x: 0, y: 0, scale: 1, opacity: 1 } : { y: 0 };
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div className="scrim" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
          <motion.div
            className={`sheet ${variant}`}
            role="dialog"
            aria-modal="true"
            aria-label={typeof title === "string" ? title : undefined}
            initial={from}
            animate={to}
            exit={from}
            transition={{ type: "spring", damping: 30, stiffness: 320 }}
          >
            <div className="sheet-grip" />
            <div className="sheet-head">
              <h3>{title}</h3>
              <button className="icon-btn" onClick={onClose} aria-label="Close"><X size={20} /></button>
            </div>
            <div className="sheet-body">{children}</div>
            {footer && <div className="sheet-foot">{footer}</div>}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

export function Segmented({ options, value, onChange, layoutId }) {
  return (
    <div className="seg" role="tablist">
      {options.map((o) => {
        const v = typeof o === "string" ? o : o.value;
        const label = typeof o === "string" ? o : o.label;
        return (
          <button key={v} role="tab" aria-selected={value === v} className={value === v ? "on" : ""} onClick={() => onChange(v)}>
            {value === v && <motion.span layoutId={layoutId || "seg"} className="seg-pill" transition={{ type: "spring", damping: 30, stiffness: 380 }} />}
            <span>{label}</span>
          </button>
        );
      })}
    </div>
  );
}

export function Stepper({ value, onChange, min = 1, max = 20, label }) {
  return (
    <div className="stepper" role="group" aria-label={label}>
      <button type="button" onClick={() => onChange(Math.max(min, value - 1))} aria-label={`Decrease ${label}`} disabled={value <= min}>−</button>
      <output aria-live="polite">{value}</output>
      <button type="button" onClick={() => onChange(Math.min(max, value + 1))} aria-label={`Increase ${label}`} disabled={value >= max}>+</button>
    </div>
  );
}

export function Alert({ kind = "info", children }) {
  const Icon = kind === "error" || kind === "warn" ? AlertTriangle : kind === "ok" ? CheckCircle2 : Info;
  return (
    <div className={`alert ${kind}`} role={kind === "error" ? "alert" : "status"}>
      <Icon size={18} />
      <div>{children}</div>
    </div>
  );
}

export function Skeleton({ h = 20, w = "100%", r, style }) {
  return <div className="skeleton" style={{ height: h, width: w, borderRadius: r, ...style }} />;
}

export function Field({ label, error, children, hint }) {
  return (
    <label className={`field ${error ? "error" : ""}`}>
      <span className="label">{label}</span>
      {children}
      {hint && !error && <span className="tiny muted">{hint}</span>}
      {error && <span className="field-error">{error}</span>}
    </label>
  );
}

export function Stat({ label, value, sub, icon: Icon }) {
  return (
    <div className="stat">
      <div className="stat-label">{Icon && <Icon size={14} />}{label}</div>
      <div className="stat-value">{value}</div>
      {sub && <div className="stat-sub">{sub}</div>}
    </div>
  );
}

let toastSetter = null;
export const toast = (msg) => toastSetter && toastSetter(msg);
export function ToastHost() {
  const [msg, setMsg] = useState(null);
  useEffect(() => {
    toastSetter = (m) => setMsg({ m, k: Date.now() });
    return () => (toastSetter = null);
  }, []);
  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(() => setMsg(null), 2600);
    return () => clearTimeout(t);
  }, [msg]);
  return (
    <AnimatePresence>
      {msg && (
        <motion.div key={msg.k} className="toast" role="status" initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 20, opacity: 0 }}>
          <CheckCircle2 size={18} /> {msg.m}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function PageHeader({ eyebrow, title, lead, children, icon: Icon }) {
  return (
    <header className="page-header">
      {eyebrow && <div className="eyebrow">{Icon && <Icon size={14} />}{eyebrow}</div>}
      <motion.h1 initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}>
        {title}
      </motion.h1>
      {lead && <p className="lead">{lead}</p>}
      {children}
    </header>
  );
}

export function ErrorState({ error, onRetry }) {
  return (
    <div className="empty">
      <AlertTriangle size={28} style={{ margin: "0 auto 10px" }} />
      <p>{error?.message || "Something went wrong."}</p>
      {onRetry && <button className="btn sm" onClick={onRetry}>Try again</button>}
    </div>
  );
}
