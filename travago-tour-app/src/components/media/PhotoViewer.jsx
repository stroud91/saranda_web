import { useEffect } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { tr } from "../../i18n";

/** Full-screen photos with previous/next. `index` is the photo shown, or null when closed. */
export default function PhotoViewer({ photos, index, onIndex, alt }) {
  const open = index !== null && index !== undefined && photos.length > 0;
  const count = photos.length;
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") onIndex(null);
      if (e.key === "ArrowRight") onIndex((index + 1) % count);
      if (e.key === "ArrowLeft") onIndex((index - 1 + count) % count);
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, index, count, onIndex]);
  if (!open) return null;
  return (
    <div className="photo-viewer" role="dialog" aria-modal="true" aria-label={tr("Photos")} onClick={() => onIndex(null)}>
      <img src={photos[index]} alt={`${alt} — ${tr("Photo {n}", { n: index + 1 })}`} onClick={(e) => e.stopPropagation()} />
      <button type="button" className="icon-btn pv-close" onClick={() => onIndex(null)} aria-label={tr("Close")}><X size={22} /></button>
      {count > 1 && (
        <>
          <button type="button" className="icon-btn pv-prev" onClick={(e) => { e.stopPropagation(); onIndex((index - 1 + count) % count); }} aria-label={tr("Previous photo")}><ChevronLeft size={24} /></button>
          <button type="button" className="icon-btn pv-next" onClick={(e) => { e.stopPropagation(); onIndex((index + 1) % count); }} aria-label={tr("Next photo")}><ChevronRight size={24} /></button>
          <span className="pv-count">{index + 1} / {count}</span>
        </>
      )}
    </div>
  );
}
