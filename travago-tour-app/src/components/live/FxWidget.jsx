import { useState } from "react";
import { ArrowLeftRight } from "lucide-react";
import { useApi } from "../../lib/useApi";
import { tr } from "../../i18n";

export function useLek() {
  const { data } = useApi("/live/fx");
  return { rate: data?.rates?.ALL || 98, live: !!data?.live, source: data?.source };
}

export function FxChip() {
  const { rate, live } = useLek();
  return <span className="live-chip">€1 = <b>{rate.toFixed(1)} L</b>{!live && <span className="tiny"> {tr("· approx.")}</span>}</span>;
}

export default function FxWidget() {
  const { rate, live, source } = useLek();
  const [eur, setEur] = useState(50);
  const [dir, setDir] = useState("eur");
  const all = dir === "eur" ? eur * rate : eur;
  const euros = dir === "eur" ? eur : eur / rate;
  return (
    <div className="fx">
      <div className="fx-row">
        <label className="fx-box">
          <span className="label">{dir === "eur" ? tr("Euro") : tr("Lek")}</span>
          <input className="input" type="number" min="0" inputMode="decimal" value={eur} onChange={(e) => setEur(Math.max(0, Number(e.target.value) || 0))} />
        </label>
        <button className="icon-btn" onClick={() => { setDir(dir === "eur" ? "all" : "eur"); setEur(Math.round(dir === "eur" ? all : euros)); }} aria-label={tr("Swap currencies")}>
          <ArrowLeftRight size={18} />
        </button>
        <div className="fx-box out">
          <span className="label">{dir === "eur" ? tr("Albanian lek") : tr("Euro")}</span>
          <div className="fx-out">{dir === "eur" ? `${Math.round(all).toLocaleString("en")} L` : `€${euros.toFixed(2)}`}</div>
        </div>
      </div>
      <div className="chips" style={{ marginTop: 10 }}>
        {[2, 5, 20, 50, 100].map((v) => <button key={v} className="chip sm" onClick={() => { setDir("eur"); setEur(v); }}>€{v}</button>)}
      </div>
      <p className="tiny faint" style={{ marginTop: 8 }}>{live ? <>Live rate · <a href="https://www.exchangerate-api.com" target="_blank" rel="noopener noreferrer">Rates By Exchange Rate API</a>.</> : "Approximate rate — check your bank's rate before exchanging."} Keep lek for cafés, parking and small purchases.</p>
    </div>
  );
}
