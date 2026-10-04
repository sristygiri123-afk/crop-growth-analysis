import { useEffect, useRef, useState, useCallback } from "react";

/**
 * Polls `fetchFn` every `intervalMs`. Tracks loading/offline state cleanly:
 * - loading: true only on the very first fetch
 * - offline: true whenever the most recent fetch attempt failed
 * - error: last error message (cleared on next successful fetch)
 */
export function usePolling(fetchFn, intervalMs = 2000, deps = []) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(false);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const timerRef = useRef(null);
  const mountedRef = useRef(true);

  const tick = useCallback(async () => {
    try {
      const result = await fetchFn();
      if (!mountedRef.current) return;
      setData(result);
      setOffline(false);
      setError(null);
      setLastUpdated(new Date());
    } catch (err) {
      if (!mountedRef.current) return;
      setOffline(true);
      setError(err.message || "Unknown error");
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, deps); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    mountedRef.current = true;
    setLoading(true);
    tick();
    timerRef.current = setInterval(tick, intervalMs);
    return () => {
      mountedRef.current = false;
      clearInterval(timerRef.current);
    };
  }, [tick, intervalMs]);

  const refresh = useCallback(() => {
    setLoading(true);
    return tick();
  }, [tick]);

  return { data, loading, offline, error, lastUpdated, refresh };
}
