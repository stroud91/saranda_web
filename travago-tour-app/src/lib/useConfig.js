import { useApi } from "./useApi";

const DEFAULT = { payments: { enabled: false }, concierge: { enabled: true, ai: false }, whatsapp: null };

export function useConfig() {
  const { data } = useApi("/meta/config");
  return data || DEFAULT;
}

/** True once the site lists at least one real guide. Sample profiles don't count,
 *  and while the config is loading the guide links stay hidden rather than flicker. */
export function useGuidesOn() {
  return useConfig().guides === true;
}

export const whatsappUrl = (number, text) =>
  number ? `https://wa.me/${number.replace(/[^\d]/g, "")}?text=${encodeURIComponent(text)}` : null;
