import { create } from "zustand";
import { persist } from "zustand/middleware";
import { uid } from "../lib/format";

const blankDay = (stops = ["sarande"]) => ({ id: uid(), title: "", stops, start_time: "08:30", notes: "" });

const initial = {
  title: "My Albania trip",
  startDate: "",
  travelers: 2,
  style: "comfort",
  pace: "balanced",
  template: null,
  days: [blankDay()],
  activeDay: 0,
  checklist: {},
  carDays: 0,
  boatDays: 0,
  guideRate: 0,
  guideDays: 0,
  shareId: null,
  editKey: null,
  savedAt: null,
  favorites: [],
};

export const useTrip = create(
  persist(
    (set, get) => ({
      ...initial,
      set: (patch) => set(patch),
      reset: () => set({ ...initial, days: [blankDay()], favorites: get().favorites, checklist: get().checklist }),
      loadItinerary: (it) =>
        set({
          title: it.title,
          template: it.slug,
          days: it.days.map((d) => ({ id: uid(), title: d.title, stops: [...d.stops], start_time: d.start_time, notes: d.plan })),
          activeDay: 0,
          pace: it.pace === "active" ? "balanced" : it.pace === "relaxed" ? "relaxed" : "balanced",
          carDays: it.days_count >= 7 ? Math.max(0, it.days_count - 2) : 0,
          shareId: null,
          editKey: null,
        }),
      loadShared: (trip) =>
        set({
          title: trip.title,
          startDate: trip.data.start_date || "",
          travelers: trip.data.travelers || 2,
          style: trip.data.style || "comfort",
          pace: trip.data.pace || "balanced",
          days: trip.data.days.map((d) => ({ id: uid(), title: d.title || "", stops: d.stops, start_time: d.start_time || "08:30", notes: d.notes || "" })),
          activeDay: 0,
          shareId: null,
          editKey: null,
        }),
      addDay: () => {
        const days = get().days;
        const last = days[days.length - 1];
        const from = last ? last.stops[last.stops.length - 1] : "sarande";
        set({ days: [...days, blankDay([from])], activeDay: days.length });
      },
      duplicateDay: (i) => {
        const days = [...get().days];
        days.splice(i + 1, 0, { ...days[i], id: uid(), stops: [...days[i].stops] });
        set({ days, activeDay: i + 1 });
      },
      removeDay: (i) => {
        const days = get().days.filter((_, j) => j !== i);
        set({ days: days.length ? days : [blankDay()], activeDay: Math.max(0, Math.min(get().activeDay, days.length - 1)) });
      },
      moveDay: (i, dir) => {
        const days = [...get().days];
        const j = i + dir;
        if (j < 0 || j >= days.length) return;
        [days[i], days[j]] = [days[j], days[i]];
        set({ days, activeDay: j });
      },
      updateDay: (i, patch) => set({ days: get().days.map((d, j) => (j === i ? { ...d, ...patch } : d)) }),
      addStop: (i, slug) => {
        const day = get().days[i];
        if (!day || day.stops.length >= 10) return;
        get().updateDay(i, { stops: [...day.stops, slug] });
      },
      removeStop: (i, k) => {
        const day = get().days[i];
        if (day.stops.length <= 1) return;
        get().updateDay(i, { stops: day.stops.filter((_, j) => j !== k) });
      },
      toggleFavorite: (slug) => {
        const f = get().favorites;
        set({ favorites: f.includes(slug) ? f.filter((s) => s !== slug) : [...f, slug] });
      },
      toggleCheck: (item) => set({ checklist: { ...get().checklist, [item]: !get().checklist[item] } }),
    }),
    { name: "saranda-trip-v2", version: 1 }
  )
);

export const tripPayload = (t) => ({
  title: t.title || "My Albania trip",
  start_date: t.startDate || null,
  travelers: t.travelers,
  style: t.style,
  pace: t.pace,
  template: t.template,
  days: t.days.map((d) => ({ title: d.title, stops: d.stops, start_time: d.start_time, notes: d.notes })),
  checklist: t.checklist,
});
