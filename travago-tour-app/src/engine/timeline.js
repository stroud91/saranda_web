// Port of app/services/timeline.py: stops → clock-time day schedule.
import { divmod, pad2, pyRound } from "./py";

export function createTimeline(data, routing) {
  const T = data.timeline;
  const PACES = T.paces;
  const PEAK = new Set(T.peak_months);
  const OUTDOOR = new Set(T.outdoor);

  function parseHhmm(value, fallback = "08:30") {
    const v = value || fallback;
    const m = /^(\d+):(\d+)$/.exec(String(v));
    if (!m) throw new Error("start_time must be HH:MM");
    const hh = Number(m[1]);
    const mm = Number(m[2]);
    if (!(hh >= 0 && hh < 24 && mm >= 0 && mm < 60)) throw new Error("start_time must be HH:MM");
    return hh * 60 + mm;
  }

  function fmt(minutes) {
    const [dayOffset, rest] = divmod(pyRound(minutes), 24 * 60);
    const out = `${pad2(Math.floor(rest / 60))}:${pad2(rest % 60)}`;
    return out + (dayOffset ? ` (+${dayOffset}d)` : "");
  }

  const round5 = (x) => Math.trunc(5 * pyRound(x / 5));
  const visitMinutes = (dest, pace) => round5(dest.visit_min + (dest.visit_max - dest.visit_min) * PACES[pace].visit);

  function buildDay(stops, { startTime = "08:30", pace = "balanced", month = null, modes } = {}) {
    if (!PACES[pace]) throw new Error("pace must be relaxed, balanced or packed");
    if (!stops.length) throw new Error("A day needs at least one stop");
    stops.forEach(routing.place);

    const cfg = PACES[pace];
    let t = parseHhmm(startTime);
    let slack = 0;
    const events = [];
    const warnings = [];
    let lunchDone = false;
    let movingMin = 0;
    let movingMax = 0;
    let kmMin = 0;
    let kmMax = 0;
    let visitTotal = 0;
    let longDriveSoFar = 0;
    const path = [];

    const add = (type, title, minutes, extra = {}) => {
      const ev = { type, title, start: fmt(t), end: fmt(t + minutes), minutes, ...extra };
      events.push(ev);
      t += minutes;
      return ev;
    };

    const maybeLunch = (where, force = false) => {
      if (!lunchDone && (force || (T.lunch_from <= t && t <= T.lunch_until))) {
        add("lunch", `Lunch + shade in ${where}`, cfg.lunch, { slug: null, note: "Planner rhythm: 12:30–14:30 lunch and shade." });
        lunchDone = true;
      }
    };

    const visit = (dest, minutes) => {
      const kw = { slug: dest.slug, category: dest.category, note: dest.planning_note };
      if (!lunchDone && T.lunch_earliest <= t && t <= T.lunch_until) maybeLunch(dest.name, true);
      const start = t;
      if (!lunchDone && t < T.lunch_from && t + minutes > T.lunch_from + 45) {
        const firstPart = Math.max(30, T.lunch_from - t);
        add("visit", dest.name, firstPart, kw);
        maybeLunch(dest.name, true);
        add("visit", `${dest.name} (continued)`, minutes - firstPart, { ...kw, note: "" });
      } else {
        add("visit", dest.name, minutes, kw);
      }
      return start;
    };

    const first = routing.place(stops[0]);
    path.push([first.lat, first.lng]);
    const single = stops.length === 1;
    if (!single) add("depart", "Start in " + first.name, 0, { slug: first.slug });

    const visited = new Set();
    if (single) {
      const minutes = visitMinutes(first, pace);
      visit(first, minutes);
      visitTotal += minutes;
      visited.add(first.slug);
    }

    const VERB = { drive: "Drive", ferry: "Ferry", boat: "Boat" };
    for (let idx = 0; idx + 1 < stops.length; idx++) {
      const b = stops[idx + 1];
      const seg = routing.connect(stops[idx], b, modes);
      for (const leg of seg.legs) {
        maybeLunch(routing.place(leg.from).name);
        let expected = round5(routing.mid(leg) * (leg.mode === "drive" ? cfg.buffer : 1.0));
        expected = Math.max(expected, leg.min_minutes);
        slack += Math.max(0, leg.max_minutes - expected);
        const toPlace = routing.place(leg.to);
        const verb = VERB[leg.mode];
        add(leg.mode, `${verb} to ${toPlace.name}`, expected, {
          slug: toPlace.slug, from_slug: leg.from, min_minutes: leg.min_minutes, max_minutes: leg.max_minutes,
          km_min: leg.km_min, km_max: leg.km_max, source: leg.source, note: leg.note,
        });
        movingMin += leg.min_minutes;
        movingMax += leg.max_minutes;
        kmMin += leg.km_min;
        kmMax += leg.km_max;
        longDriveSoFar += expected;
        path.push([toPlace.lat, toPlace.lng]);
        if (leg.mode === "ferry" || leg.mode === "boat") {
          warnings.push({ level: "info", code: "sea", text: `${verb} to ${toPlace.name}: schedules are seasonal and sea conditions can change routes — confirm with the operator.` });
        }
      }

      const dest = routing.place(b);
      const isLast = idx === stops.length - 2;
      const returning = visited.has(b) || (b === stops[0] && isLast);
      if (dest.category === "hub") {
        add("arrive", `Arrive ${dest.name}`, 0, { slug: dest.slug, note: "For flights, aim to arrive 2 hours before departure; allow time to return a rental car." });
        continue;
      }
      if (returning) {
        add("arrive", `Back in ${dest.name} — free time`, 0, { slug: dest.slug });
        continue;
      }
      if (isLast && dest.base && t >= T.evening) {
        add("arrive", `Check in — evening in ${dest.name}`, 0, { slug: dest.slug, note: "Planner rhythm: 18:00–20:00 sunset and free time, then dinner and an evening walk." });
        continue;
      }
      if (t >= T.major_sight_latest && longDriveSoFar >= 150 && (dest.category === "history" || dest.category === "nature") && !dest.base) {
        warnings.push({ level: "warn", code: "late-sight", text: `You reach ${dest.name} after a long drive late in the day. ${data.road_trip_tip}` });
      }
      const minutes = visitMinutes(dest, pace);
      const visitStart = visit(dest, minutes);
      visitTotal += minutes;
      visited.add(dest.slug);

      if (PEAK.has(month)) {
        if (OUTDOOR.has(dest.category) && visitStart < 15 * 60 + 30 && t > 12 * 60) {
          warnings.push({ level: "info", code: "heat", text: `${dest.name} falls in the midday heat. July–August can be very hot — sightsee earlier or later.` });
        }
        if (dest.peak_crowds) {
          warnings.push({ level: "info", code: "crowds", text: `${dest.name} is very busy in July–August — arrive early and confirm parking.` });
        }
      }
      if (dest.slug === "theth" && month && !(month >= 6 && month <= 9)) {
        warnings.push({ level: "warn", code: "season", text: "Theth's mountain road and services are most reliable June–September. Check conditions." });
      }
    }

    if (!lunchDone && t > T.lunch_until && events.length > 2) {
      warnings.push({ level: "info", code: "lunch", text: "No natural lunch break — pack snacks or build in a stop around 13:00." });
    }
    if (movingMax >= T.long_drive_min || longDriveSoFar >= T.long_drive_min) {
      warnings.push({ level: "warn", code: "long-drive", text: `Long travel day (up to ${Math.floor(movingMax / 60)}h${pad2(movingMax % 60)} on the road). Start early and leave buffers for fuel, photos and traffic.` });
    }
    if (t + slack > T.late_end) {
      warnings.push({ level: "warn", code: "late-finish", text: `If every leg runs long, you finish around ${fmt(t + slack)}. Consider trimming a stop.` });
    }

    const seen = new Set();
    const deduped = warnings.filter((w) => (seen.has(w.text) ? false : seen.add(w.text)));
    return {
      events,
      warnings: deduped,
      summary: {
        start: fmt(parseHhmm(startTime)),
        end: fmt(t),
        end_latest: fmt(t + slack),
        moving_minutes_min: movingMin,
        moving_minutes_max: movingMax,
        visit_minutes: visitTotal,
        km_min: kmMin,
        km_max: kmMax,
        stops: stops.length,
      },
      path,
      directions_url: routing.googleDirectionsUrl(stops),
    };
  }

  /** ``days``: [{stops, start_time}]; ``startDate``: "YYYY-MM-DD" or null. */
  function buildTrip(days, { pace = "balanced", startDate = null } = {}) {
    const keys = ["km_min", "km_max", "moving_minutes_min", "moving_minutes_max", "visit_minutes"];
    const totals = Object.fromEntries(keys.map((k) => [k, 0]));
    const base = startDate ? Date.UTC(+startDate.slice(0, 4), +startDate.slice(5, 7) - 1, +startDate.slice(8, 10)) : null;
    const out = days.map((day, i) => {
      const date = base === null ? null : new Date(base + i * 86400000);
      const result = buildDay(day.stops, { startTime: day.start_time || "08:30", pace, month: date ? date.getUTCMonth() + 1 : null });
      result.day = i + 1;
      result.date = date ? date.toISOString().slice(0, 10) : null;
      for (const k of keys) totals[k] += result.summary[k];
      return result;
    });
    return { days: out, totals };
  }

  return { buildDay, buildTrip, fmt, parseHhmm, paces: PACES };
}
