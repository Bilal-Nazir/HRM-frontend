"use client";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { errorMessage } from "@/lib/workspace";

// Keep admin operational views current without requiring a page reload.
export function useLiveData<T>(path: string) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const refresh = useCallback(() => setRefreshKey((key) => key + 1), []);
  useEffect(() => {
    let cancelled = false;
    let busy = false;
    setData(null);
    setError("");
    const load = async () => {
      if (busy) return;
      busy = true;
      try {
        const result = await api.get<T>(path);
        if (!cancelled) {
          setData(result);
          setError("");
        }
      } catch (err) {
        if (!cancelled) setError(errorMessage(err));
      } finally {
        busy = false;
      }
    };
    void load();
    const reloadVisible = () => {
      if (document.visibilityState === "visible") void load();
    };
    const timer = setInterval(reloadVisible, 30000);
    window.addEventListener("focus", reloadVisible);
    document.addEventListener("visibilitychange", reloadVisible);
    return () => {
      cancelled = true;
      clearInterval(timer);
      window.removeEventListener("focus", reloadVisible);
      document.removeEventListener("visibilitychange", reloadVisible);
    };
  }, [path, refreshKey]);
  return { data, error, refresh };
}
