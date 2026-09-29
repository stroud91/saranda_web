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
    }),
    { name: "saranda-ui", partialize: (s) => ({ theme: s.theme }) }
  )
);
