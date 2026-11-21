import { useCallback, useEffect, useRef, useState } from "react";
import { errorMessage } from "../api/client";

export interface ApiState<T> {
  data: T | undefined;
  error: string | null;
  loading: boolean;
  reload: () => Promise<void>;
}

/**
 * Loads data when `deps` change and optionally refreshes it on an interval.
 * Stale data stays visible during refreshes; out-of-order answers are dropped.
 */
export function useApi<T>(fn: () => Promise<T>, deps: unknown[], intervalMs?: number): ApiState<T> {
  const [data, setData] = useState<T>();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const seq = useRef(0);
  const fnRef = useRef(fn);
  fnRef.current = fn;

  const reload = useCallback(async () => {
    const mine = ++seq.current;
    try {
      const res = await fnRef.current();
      if (mine !== seq.current) return;
      setData(res);
      setError(null);
    } catch (e) {
      if (mine !== seq.current) return;
      setError(errorMessage(e));
    } finally {
      if (mine === seq.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    void reload();
    if (!intervalMs) return () => void seq.current++;
    const id = window.setInterval(() => {
      if (!document.hidden) void reload();
    }, intervalMs);
    return () => {
      window.clearInterval(id);
      // eslint-disable-next-line react-hooks/exhaustive-deps -- a counter, not a DOM ref
      seq.current++;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, intervalMs, reload]);

  return { data, error, loading, reload };
}

/** Re-renders on an interval so relative timestamps stay fresh. */
export function useNow(intervalMs = 10_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return now;
}
