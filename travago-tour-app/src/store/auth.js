import { create } from "zustand";
import { api, apiMode, invalidate, post } from "../lib/api";

/**
 * Who is signed in. The session itself lives in an HttpOnly cookie that
 * JavaScript can't read; this store only mirrors what /auth/me reports.
 * Accounts need the Python app, so on static hosting this stays signed out.
 */
export const useAuth = create((set, get) => ({
  user: null,
  ready: false,       // has /auth/me answered yet?
  available: false,   // does this deployment have accounts at all?
  emailDelivery: false,

  async load() {
    try {
      if ((await apiMode()) !== "server") return set({ ready: true, available: false });
      const cfg = await api("/meta/config");
      if (!cfg.auth?.enabled) return set({ ready: true, available: false });
      const me = await api("/auth/me", { cacheable: false });
      set({ user: me.user, emailDelivery: Boolean(me.email_delivery), available: true, ready: true });
    } catch {
      set({ ready: true });
    }
  },

  /** Call after any request that signs in or changes the account. */
  setUser(user) {
    invalidate("/account");
    set({ user });
  },

  async logout() {
    try {
      await post("/auth/logout", {});
    } finally {
      invalidate("/account");
      set({ user: null });
    }
    return get().user;
  },
}));

/** Only same-site paths are accepted as a post-login destination (no open redirects). */
export const safeNext = (value, fallback = "/account") =>
  typeof value === "string" && /^\/(?!\/|\\)[^\s]*$/.test(value) && !value.startsWith("/signin") && !value.startsWith("/signup") ? value : fallback;
