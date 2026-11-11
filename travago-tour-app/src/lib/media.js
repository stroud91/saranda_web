// Video library: edited Wikimedia Commons clips (self-hosted, CC BY-SA 4.0)
// plus Saranda films on YouTube (embedded only when the guest presses play).
import videos from "../data/videos.json";

export const CLIPS = videos.clips || [];
export const REEL = videos.reel || null;
export const clipByKey = Object.fromEntries(CLIPS.map((c) => [c.key, c]));
export const clipsForPlace = (slug) => CLIPS.filter((c) => c.place === slug);

// Titles as published by their creators. Embedded with YouTube's own player
// (youtube-nocookie.com) — nothing loads from YouTube until play is pressed.
export const YOUTUBE = [
  { id: "BV5NLR9lkcs", title: "SARANDA 4K — the most beautiful summer destination in Albania", place: "sarande" },
  { id: "YmpcqD5V8Dg", title: "Saranda, Albania in 4K Ultra HD", place: "sarande" },
  { id: "QsYJ0iqHs2s", title: "Albanian Riviera — Ksamil, Sarandë", place: "ksamil" },
  { id: "WpPoaidfKBU", title: "Ksamil, Albania — drone 4K", place: "ksamil" },
  { id: "7nzP45PJcgo", title: "South Albania Riviera — drone footage 4K", channel: "MTravelVlog", place: "himare" },
  { id: "aMc2MMolnL0", title: "Albanian Riviera — Gjipe Beach (Himarë, Vlorë)", place: "gjipe" },
  { id: "Te-LiTiPz7k", title: "Travel from Tirana to Saranda — drone footage 4K", channel: "MTravelVlog", place: "tirana" },
  { id: "rd75KDJgQbE", title: "Albania by drone [4K]", place: "berat" },
];

export const prefersReducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
export const saveData = () => typeof navigator !== "undefined" && Boolean(navigator.connection?.saveData);
