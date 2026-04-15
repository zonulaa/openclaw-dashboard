"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type UseVisibilityPollingOptions = {
  intervalMs?: number;
  /** When false, skip each interval tick without clearing the timer */
  enabled?: boolean;
  immediate?: boolean;
};

export function useVisibilityPolling(task: () => Promise<void>, options?: UseVisibilityPollingOptions) {
  const intervalMs = options?.intervalMs ?? 15000;
  const enabled = options?.enabled ?? true;
  const immediate = options?.immediate ?? true;

  const [isVisible, setIsVisible] = useState(true);
  const [isLoading, setIsLoading] = useState(immediate);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  const taskRef = useRef(task);
  const runningRef = useRef(false);
  // Keep a ref so the interval callback can read the latest `enabled` value
  // without needing to recreate the interval on every change.
  const enabledRef = useRef(enabled);

  useEffect(() => {
    taskRef.current = task;
  }, [task]);

  useEffect(() => {
    enabledRef.current = enabled;
  }, [enabled]);

  useEffect(() => {
    if (typeof document === "undefined") return;

    const handleVisibility = () => {
      setIsVisible(!document.hidden);
    };

    handleVisibility();
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, []);

  const run = useCallback(async (initial = false) => {
    if (runningRef.current) return;
    runningRef.current = true;
    if (initial) {
      setIsLoading(true);
    } else {
      setIsRefreshing(true);
    }

    try {
      await taskRef.current();
      setLastUpdated(new Date().toISOString());
    } finally {
      runningRef.current = false;
      if (initial) {
        setIsLoading(false);
      } else {
        setIsRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    if (immediate) {
      void run(true);
    }

    const timer = setInterval(() => {
      // Skip the tick if any UI overlay is open (enabled=false) or tab is hidden.
      // We intentionally do NOT clearInterval so the rhythm is preserved.
      if (!document.hidden && enabledRef.current) {
        void run(false);
      }
    }, intervalMs);

    return () => clearInterval(timer);
    // intervalMs and run are stable; we don't want to recreate the interval
    // when `enabled` changes — that's handled via enabledRef.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intervalMs, run]);

  return {
    isVisible,
    isLoading,
    isRefreshing,
    lastUpdated,
    refreshNow: () => run(false),
  };
}
