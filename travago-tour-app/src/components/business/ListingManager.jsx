import { useState } from "react";
import { CalendarDays, Pause, Pencil, Play, Plus, Trash2 } from "lucide-react";
import { KINDS, partnerDelete, partnerPut, reviewBadge } from "../../lib/partners";
import { thumb } from "../../lib/photos";
import { euro } from "../../lib/format";
import { toast } from "../ui";
import ListingSheet from "./ListingSheet";
import CalendarSheet from "./CalendarSheet";
import { tr } from "../../i18n";

function ListingRow({ kindKey, kind, base, item, onEdit, onCalendar, onChange, onRemove }) {
  const [busy, setBusy] = useState(false);
  const badge = reviewBadge(item);
  const name = item[kind.nameField];
  const run = async (fn) => {
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      toast(e.message);
    } finally {
      setBusy(false);
    }
  };
  const toggle = () => run(async () => {
    onChange(await partnerPut(`${base}/${kindKey}/${item.id}`, item.on ? kind.pause : kind.resume));
    toast(item.on ? tr("Paused — hidden from guests") : tr("Switched back on"));
  });
  const remove = () => window.confirm(tr("Remove “{name}”? This can't be undone.", { name })) && run(async () => {
    await partnerDelete(`${base}/${kindKey}/${item.id}`);
    onRemove(item.id);
    toast(tr("Removed"));
  });
  const cover = item.image_urls?.[0];
  return (
    <li className={`host-row ${item.review_status === "rejected" ? "needs" : ""}`}>
      {cover ? <img className="row-thumb" src={thumb(cover)} alt="" loading="lazy" /> : <span className="row-thumb none"><kind.icon size={20} /></span>}
      <div className="host-row-main">
        <div className="row between"><b>{name}</b><span className={`badge ${badge.tone}`}>{tr(badge.text)}</span></div>
        <span className="small"><b>{euro(item[kind.priceField])}</b> {tr(kind.unit)} · <span className="muted">{kind.facts(item).filter(Boolean).join(" · ")}</span></span>
        {item.review_note && <span className="small host-why">{tr("Our note: “{note}”", { note: item.review_note })}{item.review_status === "rejected" ? ` ${tr("Edit and save to send it again.")}` : ""}</span>}
      </div>
      <div className="host-actions">
        <button type="button" className="btn sm" disabled={busy} onClick={onEdit}><Pencil size={14} /> {tr("Edit")}</button>
        {onCalendar && <button type="button" className="btn sm" disabled={busy} onClick={onCalendar}><CalendarDays size={14} /> {tr("Calendar")}</button>}
        <button type="button" className="btn sm" disabled={busy} onClick={toggle}>{item.on ? <><Pause size={14} /> {tr("Pause")}</> : <><Play size={14} /> {tr("Resume")}</>}</button>
        <button type="button" className="icon-btn sm" disabled={busy} onClick={remove} aria-label={tr("Remove {name}", { name })} title={tr("Remove")}><Trash2 size={16} /></button>
      </div>
    </li>
  );
}

/**
 * Lists of listings by kind, each with add, edit, pause, calendar (stays) and remove.
 * Used by a business for its own listings and by the host for the site's own.
 */
export default function ListingManager({ listings, options, kinds = KINDS, base = "/partner/listings", host = false, full = false, onPut, onDrop }) {
  const [sheet, setSheet] = useState(null);
  const [calendar, setCalendar] = useState(null);
  return (
    <>
      {Object.entries(kinds).map(([key, kind]) => (
        <section key={key} className="stack">
          <div className="row between">
            <h2 className="h3"><kind.icon size={18} /> {tr(kind.plural)} <span className="muted small">({(listings[key] || []).length})</span></h2>
            <button type="button" className="btn sm primary" disabled={full} onClick={() => setSheet({ kind: key })}><Plus size={15} /> {tr(kind.add)}</button>
          </div>
          {(listings[key] || []).length > 0 && (
            <ul className="host-list">
              {listings[key].map((item) => (
                <ListingRow
                  key={item.id} kindKey={key} kind={kind} base={base} item={item}
                  onEdit={() => setSheet({ kind: key, item })}
                  onCalendar={key === "stays" ? () => setCalendar({ id: item.id, name: item[kind.nameField] }) : null}
                  onChange={(row) => onPut(key, row)} onRemove={(id) => onDrop(key, id)}
                />
              ))}
            </ul>
          )}
        </section>
      ))}
      <ListingSheet target={sheet} options={options} kinds={kinds} base={base} host={host} onClose={() => setSheet(null)} onSaved={onPut} />
      <CalendarSheet stay={calendar} onClose={() => setCalendar(null)} />
    </>
  );
}
