import { useEffect, useRef, useState } from "react";
import { api } from "./api";

/** Fetch `path` (skipped when null). Returns { data, error, loading, reload }. */
export function useApi(path, deps = []) {
  const [state, setState] = useState({ data: null, error: null, loading: !!path });
  const [nonce, setNonce] = useState(0);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    if (!path) {
      setState({ data: null, error: null, loading: false });
      return;
    }
    setState((s) => ({ ...s, loading: true, error: null }));
    api(path)
      .then((data) => alive.current && setState({ data, error: null, loading: false }))
      .catch((error) => alive.current && setState({ data: null, error, loading: false }));
    return () => {
      alive.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, nonce, ...deps]);

  return { ...state, reload: () => setNonce((n) => n + 1) };
}

/** Debounced POST that re-runs when `body` changes (by JSON value). */
export function useLivePost(path, body, delay = 350) {
  const [state, setState] = useState({ data: null, error: null, loading: false });
  const json = body ? JSON.stringify(body) : null;
  useEffect(() => {
    if (!json) return;
    let cancelled = false;
    setState((s) => ({ ...s, loading: true }));
    const t = setTimeout(() => {
      import("./api").then(({ post }) =>
        post(path, JSON.parse(json))
          .then((data) => !cancelled && setState({ data, error: null, loading: false }))
          .catch((error) => !cancelled && setState((s) => ({ ...s, error, loading: false })))
      );
    }, delay);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [path, json, delay]);
  return state;
}
