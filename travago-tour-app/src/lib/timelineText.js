// Day timelines come from the trip engine (app/services/timeline.py, and engine/timeline.js
// on the static copy) as English sentences built from a few fixed patterns. These turn them
// into the visitor's language. Anything not recognised is shown as it came.
import { localizeContent, tr } from "../i18n";

/** A place name in the visitor's language (Blue Eye → Syri i Kaltër); most names stay as they are. */
const place = (name) => localizeContent({ name }).name;

const TITLES = [
  [/^Start in (.+)$/, "Start in {place}"],
  [/^Drive to (.+)$/, "Drive to {place}"],
  [/^Ferry to (.+)$/, "Ferry to {place}"],
  [/^Boat to (.+)$/, "Boat to {place}"],
  [/^Lunch \+ shade in (.+)$/, "Lunch + shade in {place}"],
  [/^Back in (.+) — free time$/, "Back in {place} — free time"],
  [/^Check in — evening in (.+)$/, "Check in — evening in {place}"],
  [/^Arrive (.+)$/, "Arrive {place}"],
  [/^(.+) \(continued\)$/, "{place} (continued)"],
];

/** A step's title: "Drive to Gjirokastër" → "Fahrt nach Gjirokastër". */
export function stepTitle(title) {
  for (const [re, key] of TITLES) {
    const m = re.exec(title || "");
    if (m) return tr(key, { place: place(m[1]) });
  }
  return place(title); // a visit: just the place's name
}

const WARNINGS = {
  sea: [/^(Ferry|Boat) to (.+?): schedules are seasonal/, (m) => tr("{trip}: schedules are seasonal and sea conditions can change routes — confirm with the operator.", { trip: stepTitle(`${m[1]} to ${m[2]}`) })],
  "late-sight": [/^You reach (.+?) after a long drive late in the day\. (.*)$/s, (m) => `${tr("You reach {place} after a long drive late in the day.", { place: place(m[1]) })} ${localizeContent({ tip: m[2] }).tip}`],
  heat: [/^(.+) falls in the midday heat\./, (m) => tr("{place} falls in the midday heat. July–August can be very hot — sightsee earlier or later.", { place: place(m[1]) })],
  crowds: [/^(.+) is very busy in July–August/, (m) => tr("{place} is very busy in July–August — arrive early and confirm parking.", { place: place(m[1]) })],
  "long-drive": [/^Long travel day \(up to (\S+) on the road\)/, (m) => tr("Long travel day (up to {time} on the road). Start early and leave buffers for fuel, photos and traffic.", { time: m[1] })],
  "late-finish": [/you finish around (.+?)\. Consider/, (m) => tr("If every leg runs long, you finish around {time}. Consider trimming a stop.", { time: m[1] })],
};

/** A warning's sentence in the visitor's language. */
export function warningText(w) {
  const rule = WARNINGS[w.code];
  const m = rule && rule[0].exec(w.text || "");
  return m ? rule[1](m) : tr(w.text);
}
