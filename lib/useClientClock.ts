"use client";
import { useEffect, useState } from "react";

// Server HTML and the first browser render must use the same placeholder.
export function useClientClock() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);
  return now;
}
