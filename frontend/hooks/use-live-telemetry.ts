"use client";
import { useEffect, useState } from "react";
import type { TelemetryRow } from "@/lib/api-client";

interface LiveTelemetryState {
  data: TelemetryRow | null;
  lastUpdateMs: number | null;
  connected: boolean;
}

export function useLiveTelemetry(): LiveTelemetryState {
  const [state, setState] = useState<LiveTelemetryState>({
    data: null, lastUpdateMs: null, connected: false,
  });

  useEffect(() => {
    let isMounted = true;
    let lastSeq = -1;

    const fetchLatest = async () => {
      try {
        const res = await fetch('/api/telemetry?mode=latest');
        if (!res.ok) throw new Error('Network err');
        
        const json = await res.json();
        if (json.success && json.data && isMounted) {
          // Only update state if the seq_number actually changed (real-time stream)
          if (json.data.seq_number !== lastSeq) {
            lastSeq = json.data.seq_number;
            setState({
              data: json.data,
              lastUpdateMs: Date.now(),
              connected: true
            });
          }
        }
      } catch (err) {
        if (isMounted) {
          setState(s => ({ ...s, connected: false }));
        }
      }
    };

    // Fetch immediately
    fetchLatest();

    // Poll every 1 second matching the Simulator's 1Hz tick
    const interval = setInterval(fetchLatest, 1000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  return state;
}
