import { create } from "zustand";
import { persist } from "zustand/middleware";

export const useUi = create(
  persist(
    (set) => ({
      theme: "system", // system | light | dark
      conciergeOpen: false,
      conciergeDraft: "",
      setTheme: (theme) => set({ theme }),
      openConcierge: (draft = "") => set({ conciergeOpen: true, conciergeDraft: draft }),
      closeConcierge: () => set({ conciergeOpen: false }),
      paletteOpen: false,
      openPalette: () => set({ paletteOpen: true }),
      closePalette: () => set({ paletteOpen: false }),
      cycleTheme: () => set((s) => ({ theme: { system: "light", light: "dark", dark: "system" }[s.theme] })),
    }),
    { name: "saranda-ui", partialize: (s) => ({ theme: s.theme }) }
  )
);
