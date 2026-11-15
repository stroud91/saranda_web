import { useState } from "react";
import { MessageSquare, ShieldCheck, Star } from "lucide-react";
import { useApi } from "../../lib/useApi";
import { locale, plural, tr } from "../../i18n";

/** Five stars, `value` of them filled. */
export function Stars({ value, size = 15 }) {
  return (
    <span className="stars" role="img" aria-label={tr("{n} out of 5", { n: value })}>
      {[1, 2, 3, 4, 5].map((n) => <Star key={n} size={size} fill={n <= Math.round(value) ? "currentColor" : "none"} strokeWidth={1.8} />)}
    </span>
  );
}

const month = (ym) => (ym ? new Date(`${ym}-15T12:00:00`).toLocaleDateString(locale(), { month: "long", year: "numeric" }) : "");

/** One review as guests see it; `children` adds controls for the host or the business. */
export function ReviewCard({ r, children }) {
  return (
    <li className="review">
      <div className="row between wrap gap-sm">
        <Stars value={r.rating} />
        <span className="tiny muted">{r.author} · {tr("stayed {when}", { when: month(r.stay_month) })}</span>
      </div>
      {r.title && <b>{r.title}</b>}
      <p className="review-text">{r.text}</p>
      {r.reply && <div className="review-reply"><span className="tiny muted"><MessageSquare size={12} /> {tr("Reply from the host")}</span><p>{r.reply}</p></div>}
      {children}
    </li>
  );
}

/** Reviews of one stay: the average, how the ratings are spread, and what guests wrote. */
export default function Reviews({ stayId }) {
  const { data } = useApi(`/reviews/stays/${stayId}`);
  const [all, setAll] = useState(false);
  if (!data || !data.count) return null; // nothing yet (or reviews are off): no empty box
  const shown = all ? data.reviews : data.reviews.slice(0, 4);
  return (
    <section className="card pad stack" id="reviews">
      <div className="review-head">
        <div className="review-score"><b>{data.average.toFixed(1)}</b><Stars value={data.average} size={18} /><span className="small muted">{plural(data.count, "{n} review", "{n} reviews")}</span></div>
        <div className="review-bars" aria-hidden="true">
          {[5, 4, 3, 2, 1].map((n) => (
            <div key={n}><span className="tiny muted">{n}</span><i><b style={{ width: `${(100 * data.spread[n]) / data.count}%` }} /></i><span className="tiny muted">{data.spread[n]}</span></div>
          ))}
        </div>
      </div>
      <ul className="review-list">{shown.map((r) => <ReviewCard key={r.id} r={r} />)}</ul>
      {data.reviews.length > shown.length && <button type="button" className="btn sm" onClick={() => setAll(true)}>{tr("Show all {n} reviews", { n: data.reviews.length })}</button>}
      <p className="tiny muted" style={{ margin: 0 }}><ShieldCheck size={13} /> {tr("Only guests who booked here and finished their stay can write a review. We publish them all, good or bad.")}</p>
    </section>
  );
}
