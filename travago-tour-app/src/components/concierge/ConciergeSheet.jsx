import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Send, Sparkles, MapPin, Route, CalendarRange, Users, Wallet, RotateCcw } from "lucide-react";
import { Sheet } from "../ui";
import { post } from "../../lib/api";
import { Markdown } from "../../lib/markdown";
import { useUi } from "../../store/ui";
import { useDestinations } from "../../lib/useDestinations";

const SUGGESTIONS = [
  "How long from Tirana to Ksamil?",
  "Plan 10 days in Albania",
  "Budget for 2 people, 7 days in August",
  "Best quiet beaches near Sarandë",
  "What should I eat in Gjirokastër?",
  "Blue Eye and Gjirokastër in one day?",
  "Show me local guides",
  "Corfu ferry tips",
];

const STORE_KEY = "saranda-concierge";

function load() {
  try {
    return JSON.parse(sessionStorage.getItem(STORE_KEY)) || [];
  } catch {
    return [];
  }
}

function ActionCard({ card, name }) {
  const common = { className: "chat-card" };
  switch (card.type) {
    case "destination":
      return <Link {...common} to={`/explore/${card.slug}`}><MapPin size={16} /> {name(card.slug)}</Link>;
    case "route":
      return <Link {...common} to={`/routes?from=${card.from}&to=${card.to}`}><Route size={16} /> {name(card.from)} → {name(card.to)}</Link>;
    case "itinerary":
      return <Link {...common} to={`/itineraries/${card.slug}`}><CalendarRange size={16} /> Open itinerary</Link>;
    case "guide":
      return <Link {...common} to={`/guides/${card.slug}`}><Users size={16} /> Guide profile</Link>;
    case "budget":
      return <Link {...common} to="/plan?tab=budget"><Wallet size={16} /> Budget planner</Link>;
    case "day":
      return <Link {...common} to="/plan"><CalendarRange size={16} /> Open planner</Link>;
    default:
      return null;
  }
}

export default function ConciergeSheet() {
  const { conciergeOpen, closeConcierge, conciergeDraft } = useUi();
  const { name } = useDestinations();
  const [messages, setMessages] = useState(load);
  const [input, setInput] = useState(conciergeDraft || "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const endRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    try {
      sessionStorage.setItem(STORE_KEY, JSON.stringify(messages.slice(-30)));
    } catch {
      /* storage unavailable */
    }
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, busy]);

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 250);
  }, []);

  async function send(text) {
    const q = (text ?? input).trim();
    if (!q || busy) return;
    const next = [...messages, { role: "user", content: q }];
    setMessages(next);
    setInput("");
    setError("");
    setBusy(true);
    try {
      const res = await post("/concierge/", { messages: next.map(({ role, content }) => ({ role, content })).slice(-12) });
      setMessages((m) => [...m, { role: "assistant", content: res.text, cards: res.cards, engine: res.engine }]);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet
      open={conciergeOpen}
      onClose={closeConcierge}
      title={<span className="row" style={{ gap: 8 }}><Sparkles size={18} /> Saranda Concierge</span>}
      footer={
        <form className="chat-input" onSubmit={(e) => { e.preventDefault(); send(); }}>
          <input
            ref={inputRef}
            className="input"
            placeholder="Ask about routes, beaches, budgets…"
            value={input}
            maxLength={1500}
            onChange={(e) => setInput(e.target.value)}
            aria-label="Message the concierge"
          />
          <button className="btn primary" disabled={busy || !input.trim()} aria-label="Send"><Send size={18} /></button>
        </form>
      }
    >
      <div className="chat">
        {!messages.length && (
          <div className="chat-hello">
            <div className="chat-orb"><Sparkles size={26} /></div>
            <h3>Mirëdita! 👋</h3>
            <p className="muted">I know every road time, beach and budget in the 2027 planner. Ask me anything about your Albania trip.</p>
            <div className="chips">
              {SUGGESTIONS.map((s) => (
                <button key={s} className="chip sm" onClick={() => send(s)}>{s}</button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m, i) => (
          <motion.div key={i} className={`bubble ${m.role}`} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
            {m.role === "assistant" ? <Markdown text={m.content} /> : <p>{m.content}</p>}
            {m.cards?.length > 0 && (
              <div className="chat-cards">{m.cards.map((c, k) => <ActionCard key={k} card={c} name={name} />)}</div>
            )}
          </motion.div>
        ))}
        {busy && (
          <div className="bubble assistant typing" aria-label="Concierge is typing">
            <span /><span /><span />
          </div>
        )}
        {error && <div className="alert error">{error}</div>}
        {messages.length > 0 && !busy && (
          <button className="btn ghost sm" onClick={() => setMessages([])} style={{ alignSelf: "center" }}>
            <RotateCcw size={14} /> New conversation
          </button>
        )}
        <div ref={endRef} />
      </div>
    </Sheet>
  );
}
