import { useApi } from "./useApi";

const DEFAULT = { payments: { enabled: false }, concierge: { enabled: true, ai: false }, whatsapp: null };

export function useConfig() {
  const { data } = useApi("/meta/config");
  return data || DEFAULT;
}

export const whatsappUrl = (number, text) =>
  number ? `https://wa.me/${number.replace(/[^\d]/g, "")}?text=${encodeURIComponent(text)}` : null;
