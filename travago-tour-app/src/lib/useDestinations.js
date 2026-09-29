import { useMemo } from "react";
import { useApi } from "./useApi";

/** All destinations + lookup by slug (cached by the API layer). */
export function useDestinations() {
  const { data, loading, error } = useApi("/destinations");
  return useMemo(() => {
    const list = data?.destinations || [];
    const bySlug = Object.fromEntries(list.map((d) => [d.slug, d]));
    return { list, bySlug, regions: data?.regions || {}, categories: data?.categories || {}, loading, error, name: (s) => bySlug[s]?.name || s };
  }, [data, loading, error]);
}
