"use client";
import { useEffect, useState } from "react";
import { useLiveTelemetry } from "./use-live-telemetry";
import type { TelemetryRow } from "@/lib/api-client";

// Realtime subscriptions (Session 13) deliver one new row at a time —
// this hook accumulates them into a bounded client-side window,
// specifically for charting, which is a genuinely different need than
// "what's the current value" (Session 14's use case).
export function useRollingWindow(windowSize: number = 60) {
  const live = useLiveTelemetry();
  const [window, setWindow] = useState<TelemetryRow[]>([]);

  useEffect(() => {
    if (!live.data) return;
    setWindow((prev) => {
      const next = [...prev, live.data!];
      return next.length > windowSize ? next.slice(next.length - windowSize) : next;
    });
  }, [live.data, windowSize]);

  return { window, connected: live.connected, lastUpdateMs: live.lastUpdateMs };
}
