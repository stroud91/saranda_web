import { useEffect, useState } from "react";
import { Eye, EyeOff, MessageSquare, Star } from "lucide-react";
import { fresh, partnerPatch } from "../../lib/partners";
import { Alert, Skeleton, toast } from "../ui";
import { ReviewCard } from "../stays/Reviews";
import { tr } from "../../i18n";

/**
 * Reviews as the people who host the stays see them. A business (`mode="partner"`)
 * can post one public reply. The site's host can also hide a review that breaks
 * the rules, and must say why. Nobody can edit what a guest wrote.
 */
function Row({ r, mode, onChange }) {
  const base = mode === "host" ? "/admin/reviews" : "/partner/reviews";
  const [reply, setReply] = useState(null); // null = not editing
  const [busy, setBusy] = useState(false);
  const canReply = mode === "partner" || !r.business;
  const send = async (body, done) => {
    setBusy(true);
    try {
      onChange(await partnerPatch(`${base}/${r.id}`, body));
      toast(done);
      setReply(null);
    } catch (e) {
      toast(e.message);
    } finally {
      setBusy(false);
    }
  };
  const hide = () => {
    const reason = window.prompt(tr("Why is this review being hidden? (abusive, off-topic, personal details…)"));
    if (reason && reason.trim().length >= 5) send({ action: "hide", reason: reason.trim() }, tr("Hidden from the page"));
    else if (reason !== null) toast(tr("Give a reason of at least a few words."));
  };
  return (
    <ReviewCard r={r}>
      <div className="row between wrap gap-sm">
        <span className="tiny muted">{r.hotel_name}{r.business ? ` · ${r.business.name}` : ""} · {r.reference}</span>
        {r.status === "hidden" && <span className="badge terracotta">{tr("Hidden")}: {r.hidden_reason}</span>}
      </div>
      {reply !== null ? (
        <div className="stack" style={{ "--gap": "8px" }}>
          <textarea className="textarea" rows={3} maxLength={1500} value={reply} onChange={(e) => setReply(e.target.value)} aria-label={tr("Your public reply")} autoFocus />
          <div className="host-actions">
            <button type="button" className="btn sm primary" disabled={busy} onClick={() => send({ reply: reply.trim() }, reply.trim() ? tr("Reply published") : tr("Reply removed"))}>{tr("Publish reply")}</button>
            <button type="button" className="btn sm" disabled={busy} onClick={() => setReply(null)}>{tr("Cancel")}</button>
          </div>
        </div>
      ) : (
        <div className="host-actions">
          {canReply && <button type="button" className="btn sm" disabled={busy} onClick={() => setReply(r.reply || "")}><MessageSquare size={14} /> {r.reply ? tr("Edit reply") : tr("Reply")}</button>}
          {mode === "host" && (r.status === "hidden"
            ? <button type="button" className="btn sm" disabled={busy} onClick={() => send({ action: "publish" }, tr("Back on the page"))}><Eye size={14} /> {tr("Show again")}</button>
            : <button type="button" className="btn sm" disabled={busy} onClick={hide}><EyeOff size={14} /> {tr("Hide")}</button>)}
        </div>
      )}
    </ReviewCard>
  );
}

export default function ReviewDesk({ mode = "host" }) {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => { fresh(mode === "host" ? "/admin/reviews" : "/partner/reviews").then(setRows).catch((e) => setError(e.message)); }, [mode]);
  if (error) return <Alert kind="error">{error}</Alert>;
  if (!rows) return <Skeleton h={220} r={20} />;
  const put = (row) => setRows((list) => list.map((x) => (x.id === row.id ? row : x)));
  return (
    <section className="stack">
      <h2 className="h3"><Star size={18} /> {tr("Guest reviews")} <span className="muted small">({rows.length})</span></h2>
      <p className="small muted" style={{ margin: 0 }}>
        {mode === "host"
          ? tr("Reviews appear as soon as a guest writes one. Reply in public, and hide only what is abusive, off-topic or reveals personal details.")
          : tr("Guests are emailed a review link the day after check-out. You can post one public reply to each review.")}
      </p>
      {!rows.length && <p className="muted">{tr("No reviews yet.")}</p>}
      <ul className="review-list desk">{rows.map((r) => <Row key={r.id} r={r} mode={mode} onChange={put} />)}</ul>
    </section>
  );
}
