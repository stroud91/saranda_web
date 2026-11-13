import { useEffect } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  BookOpen, Sun, Wallet, Utensils, Waves, Backpack, ShieldCheck, Phone, Ship, ListChecks, Library, Check, Clock, Lightbulb, Sparkles,
} from "lucide-react";
import { useApi } from "../lib/useApi";
import { MONTHS } from "../lib/format";
import FxWidget from "../components/live/FxWidget";
import { PageHeader, Skeleton, Alert } from "../components/ui";
import { useTrip } from "../store/trip";
import { useUi } from "../store/ui";
import { tr } from "../i18n";

const SECTIONS = [
  ["seasons", "When to go", Sun],
  ["money", "Money", Wallet],
  ["budget", "Budgets", Wallet],
  ["food", "Food", Utensils],
  ["beaches", "Beaches", Waves],
  ["packing", "Packing", Backpack],
  ["safety", "Safety", ShieldCheck],
  ["emergency", "Emergency", Phone],
  ["corfu", "Corfu", Ship],
  ["booking", "Booking", ListChecks],
  ["sources", "Sources", Library],
];

const FOOD_TONES = { bakery: "sun", coast: "sea", classic: "terracotta", gjirokaster: "olive", fresh: "olive", sweet: "pink", drink: "pink" };

function Section({ id, icon: Icon, title, children, eyebrow }) {
  return (
    <motion.section id={id} className="ess-section" initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-60px" }}>
      <div className="eyebrow"><Icon size={14} /> {eyebrow || title}</div>
      <h2>{title}</h2>
      {children}
    </motion.section>
  );
}

function ClimateChart({ climate }) {
  const W = 640, H = 220, P = 30;
  const x = (m) => P + ((m - 1) / 11) * (W - P * 2);
  const y = (t) => H - P - ((t - 10) / 25) * (H - P * 2);
  const line = (k) => climate.map((c, i) => `${i ? "L" : "M"}${x(c.month).toFixed(1)},${y(c[k]).toFixed(1)}`).join(" ");
  const now = new Date().getMonth() + 1;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="climate-chart" role="img" aria-label="Typical Sarandë air highs and sea temperature by month">
      {[15, 20, 25, 30].map((t) => (
        <g key={t}><line x1={P} x2={W - P} y1={y(t)} y2={y(t)} className="grid-line" /><text x={4} y={y(t) + 4} className="axis">{t}°</text></g>
      ))}
      <rect x={x(7) - 14} y={P / 2} width={x(8) - x(7) + 28} height={H - P * 1.5} className="peak-band" rx="8" />
      <text x={(x(7) + x(8)) / 2} y={P / 2 + 14} textAnchor="middle" className="axis strong">Peak</text>
      <path d={`${line("air_high")} L${x(12)},${H - P} L${x(1)},${H - P} Z`} className="area-air" />
      <path d={line("air_high")} className="line-air" />
      <path d={line("sea")} className="line-sea" />
      {climate.map((c) => (
        <g key={c.month}>
          <circle cx={x(c.month)} cy={y(c.air_high)} r={c.month === now ? 6 : 3.5} className="dot-air" />
          <circle cx={x(c.month)} cy={y(c.sea)} r={c.month === now ? 6 : 3.5} className="dot-sea" />
          <text x={x(c.month)} y={H - 8} textAnchor="middle" className={`axis ${c.month === now ? "strong" : ""}`}>{MONTHS[c.month - 1]}</text>
        </g>
      ))}
    </svg>
  );
}

export default function Essentials() {
  const { data: e } = useApi("/essentials");
  const { checklist, toggleCheck } = useTrip();
  const ask = useUi((s) => s.openConcierge);
  useEffect(() => { document.title = "Know before you go · Saranda Companion"; }, []);
  if (!e) return <div className="page container"><Skeleton h={500} r={26} /></div>;
  return (
    <div className="page container essentials">
      <PageHeader eyebrow={`Know before you go · ${e.edition}`} icon={BookOpen} title={tr("Everything practical, in one place")} lead={tr("Seasons, money, budgets, food, beaches, packing, safety and the Corfu connection — from The Ultimate Albania Travel Planner 2027.")} />
      <div className="quick-start card pad">
        <b>{tr("Quick start")}</b>
        <ol>{e.quick_start.map((q) => <li key={q}>{q}</li>)}</ol>
      </div>
      <nav className="ess-nav chips scroll" aria-label={tr("Sections")}>
        {SECTIONS.map(([id, label, Icon]) => <a key={id} href={`#${id}`} className="chip sm"><Icon size={13} /> {label}</a>)}
      </nav>

      <Section id="seasons" icon={Sun} title={tr("When to go")}>
        <div className="card pad"><ClimateChart climate={e.climate} /><div className="row tiny muted" style={{ gap: 14 }}><span className="legend air">{tr("Air high")}</span><span className="legend sea">{tr("Sea temperature")}</span><span>{tr("Typical Sarandë averages")}</span></div></div>
        <div className="grid" style={{ "--min": "220px", marginTop: 16 }}>
          {e.seasons.map((s) => (
            <div key={s.key} className={`season-tile s-${s.key}`}><b>{s.months}</b><span className="badge glass">{s.verdict}</span><p className="small">{s.text}</p></div>
          ))}
        </div>
      </Section>

      <Section id="money" icon={Wallet} title={tr("Money & the lek")}>
        <div className="split">
          <ul className="check-list">{e.money.map((m) => <li key={m}>{m}</li>)}</ul>
          <div className="card pad"><h3>{tr("Converter")}</h3><FxWidget /></div>
        </div>
      </Section>

      <Section id="budget" icon={Wallet} title={tr("Daily budget guide")}>
        <div className="grid" style={{ "--min": "240px" }}>
          {e.budget_tiers.map((t, i) => (
            <div key={t.key} className={`tier-card tier-${i}`}>
              <span className="eyebrow light">{t.label}</span>
              <div className="tier-price">€{t.min}–€{t.max}{t.key === "premium" ? "+" : ""}</div>
              <span className="tiny">{tr("per person per day")}</span>
              <p className="small">{t.choices}</p>
            </div>
          ))}
        </div>
        <div className="card pad" style={{ marginTop: 16 }}>
          <table className="table">
            <thead><tr><th>{tr("Category")}</th><th>{tr("Planning range")}</th></tr></thead>
            <tbody>{e.budget_categories.map((c) => <tr key={c.item}><td>{c.item}</td><td>{c.range}</td></tr>)}</tbody>
          </table>
        </div>
        <div className="tip-card" style={{ marginTop: 16 }}><Lightbulb size={20} /><div><b>{tr("Save money")}</b><p className="mb-0">{e.save_money.join(" ")}</p></div></div>
        <p className="tiny muted">{e.price_note} <Link to="/plan?tab=budget">Estimate your own trip →</Link></p>
      </Section>

      <Section id="food" icon={Utensils} title={tr("Food & what to order")}>
        <div className="grid" style={{ "--min": "220px" }}>
          {e.food.map((f, i) => (
            <motion.div key={f.name} className="food-card card pad" initial={{ opacity: 0, scale: 0.96 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }} transition={{ delay: (i % 4) * 0.05 }}>
              <span className={`badge ${FOOD_TONES[f.tag] || ""}`}>{f.tag}</span>
              <h3>{f.name}</h3>
              <p className="small muted mb-0">{f.what}</p>
            </motion.div>
          ))}
        </div>
        <div className="tip-card" style={{ marginTop: 16 }}><Utensils size={20} /><div><b>{tr("Restaurant tip")}</b><p className="mb-0">{e.restaurant_tip}</p></div></div>
      </Section>

      <Section id="beaches" icon={Waves} title={tr("Best beaches")}>
        <p className="muted">{tr("Choose your beach by the experience you want — not simply social-media popularity.")}</p>
        <div className="beach-list">
          {e.beaches.map((b) => (
            <Link key={b.slug} to={`/explore/${b.slug}`} className="beach-row">
              <b>{b.name}</b><span>{b.best_for}</span><span className="tiny muted">{b.note}</span>
            </Link>
          ))}
        </div>
        <Alert kind="info"><b>Beach-day rule:</b> {e.beach_rule}</Alert>
        <div className="tip-card" style={{ marginTop: 12 }}><Ship size={20} /><div><b>{tr("Boat day idea")}</b><p className="mb-0">{e.boat_day}</p></div></div>
      </Section>

      <Section id="packing" icon={Backpack} title={tr("Packing checklist")}>
        <p className="small muted">{tr("Tick items off — your list is saved on this device and shared with the planner.")}</p>
        <div className="grid" style={{ "--min": "240px" }}>
          {Object.entries(e.packing).map(([group, items]) => (
            <div key={group} className="card pad check-group">
              <h4>{group}</h4>
              {items.map((i) => (
                <label key={i} className={`check ${checklist[i] ? "on" : ""}`}>
                  <input type="checkbox" checked={!!checklist[i]} onChange={() => toggleCheck(i)} />
                  <span className="box"><Check size={13} /></span> {i}
                </label>
              ))}
            </div>
          ))}
        </div>
      </Section>

      <Section id="safety" icon={ShieldCheck} title={tr("Safety, etiquette & a daily rhythm")}>
        <div className="split">
          <div className="stack" style={{ "--gap": "10px" }}>
            {e.safety.map((s) => <div key={s.topic} className="safety-row"><b>{s.topic}</b><span className="small">{s.tip}</span></div>)}
          </div>
          <div className="card pad">
            <h3><Clock size={18} /> {tr("A simple daily rhythm")}</h3>
            <ol className="rhythm">{e.daily_rhythm.map((r) => <li key={r.time}><span>{r.time}</span><b>{r.label}</b></li>)}</ol>
            <p className="tiny muted">{e.road_trip_tip}</p>
          </div>
        </div>
      </Section>

      <Section id="emergency" icon={Phone} title={tr("Emergency numbers")}>
        <div className="grid" style={{ "--min": "180px" }}>
          {e.emergency.map((n) => (
            <a key={n.number} href={`tel:${n.number}`} className={`sos-card ${n.number === "112" ? "main" : ""}`}>
              <span className="sos-num">{n.number}</span><span>{n.service}</span>
            </a>
          ))}
        </div>
      </Section>

      <Section id="corfu" icon={Ship} title={tr("The Corfu–Albania connection")}>
        <p>{e.corfu.summary}</p>
        <div className="split">
          <ul className="check-list">{e.corfu.checklist.map((c) => <li key={c}>{c}</li>)}</ul>
          <div className="stack" style={{ "--gap": "10px" }}>
            {e.corfu.combos.map((c) => <div key={c.length} className="combo"><b>{c.length}</b><span>{c.idea}</span></div>)}
            <Alert kind="warn">{e.corfu.promise}</Alert>
          </div>
        </div>
      </Section>

      <Section id="booking" icon={ListChecks} title={tr("Booking strategy")}>
        <ul className="check-list">{e.booking_strategy.map((b) => <li key={b}>{b}</li>)}</ul>
        <Alert kind="info"><b>Final check:</b> {e.final_check}</Alert>
      </Section>

      <Section id="sources" icon={Library} title={tr("Sources & disclaimer")}>
        <ul className="sources">{e.sources.map((s) => <li key={s.name}><span className={`badge ${s.kind === "live" ? "sea" : s.kind === "official" ? "olive" : "sun"}`}>{s.kind}</span> {s.name}</li>)}</ul>
        <p className="small muted">{e.disclaimer}</p>
        <p className="tiny faint">Last reviewed {e.last_reviewed}.</p>
        <button className="btn" onClick={() => ask()}><Sparkles size={16} /> {tr("Still have a question? Ask the concierge")}</button>
      </Section>
    </div>
  );
}
