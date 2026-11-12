import { create } from "zustand";
import { persist } from "zustand/middleware";
import { applyLang, isLang } from "../i18n";

export const useUi = create(
  persist(
    (set, get) => ({
      theme: "system", // system | light | dark
      lang: null, // sq | en | fr | it | de; null until chosen (then the browser's language is used)
      langVersion: 0, // bumped when the language's words are loaded, to redraw the app
      async setLang(code) {
        if (!isLang(code) || code === get().lang) return;
        set({ lang: code });
        await applyLang(code);
        set((s) => ({ langVersion: s.langVersion + 1 }));
      },
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
    { name: "saranda-ui", partialize: (s) => ({ theme: s.theme, lang: s.lang }) }
  )
);
