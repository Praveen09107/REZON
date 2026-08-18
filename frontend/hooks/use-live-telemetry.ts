"use client";
import { useEffect, useState, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { getLatestTelemetry, type TelemetryRow } from "@/lib/api-client";

interface LiveTelemetryState {
  data: TelemetryRow | null;
  lastUpdateMs: number | null;   // for the resilience wrapper (FILE 5)
  connected: boolean;
}

// Tier 1 (Frontend Spec §6): Home, Sensor Streams, Safety Chain Monitor.
// Push-based, matching the ~1s device fusion cycle — no polling delay.
export function useLiveTelemetry(): LiveTelemetryState {
  const [state, setState] = useState<LiveTelemetryState>({
    data: null, lastUpdateMs: null, connected: false,
  });
  const supabase = useRef(createClient());

  useEffect(() => {
    getLatestTelemetry().then((row) => {
      if (row) setState({ data: row, lastUpdateMs: Date.now(), connected: true });
    });

    const channel = supabase.current
      .channel("live-telemetry")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "telemetry" },
          (payload) => {
            setState({ data: payload.new as TelemetryRow, lastUpdateMs: Date.now(), connected: true });
          })
      .subscribe((status) => {
        setState((prev) => ({ ...prev, connected: status === "SUBSCRIBED" }));
      });

    return () => { channel.unsubscribe(); };
  }, []);

  return state;
}
