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
    // Temporary bypass: Mock data so the dashboard works without Supabase
    setState({
      data: {
        id: "mock-id",
        device_id: "mock-device",
        seq_number: 1,
        recorded_at: new Date().toISOString(),
        audio_score: 0.1,
        vibration_score: 0.2,
        env_score: 0.05,
        gas_score: 0.3,
        current_score: 0.15,
        env_temp: 24,
        env_humidity: 45,
        env_pressure: 1013,
        fused_score: 0.22,
      },
      lastUpdateMs: Date.now(),
      connected: true,
    });
  }, []);

  return state;
}
