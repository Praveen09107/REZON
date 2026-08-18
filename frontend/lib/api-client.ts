import { createClient } from "./supabase/client";

// Typed wrapper — real field names matching Backend Spec §1's schema
// exactly, checked against the live document while writing this file,
// not assumed. Session 12+'s data hooks build on these, not raw
// Supabase calls scattered per-component.

export interface TelemetryRow {
  id: string;
  device_id: string;
  recorded_at: string;
  audio_score: number;
  vibration_score: number;
  env_score: number;
  gas_score: number;
  current_score: number;
  fused_score: number;
  env_temp: number;
  env_humidity: number;
  env_pressure: number;
}

export async function getLatestTelemetry(): Promise<TelemetryRow | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("telemetry")
    .select("*")
    .order("recorded_at", { ascending: false })
    .limit(1)
    .single();
  if (error) {
    console.error("getLatestTelemetry failed:", error.message);
    return null;
  }
  return data;
}

export function subscribeToTelemetry(onInsert: (row: TelemetryRow) => void) {
  const supabase = createClient();
  return supabase
    .channel("telemetry-live")
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "telemetry" },
        (payload) => onInsert(payload.new as TelemetryRow))
    .subscribe();
}
