"use client";
import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";

// Tier 3 (Frontend Spec §6): Since-Calibration, Digest, Trust Audit,
// Settings, Access. Fetch-on-mount only — no refetchInterval at all,
// the deliberate difference from Tier 2, not an oversight.
export function useStaticQuery<T>(queryKey: string[], table: string) {
  return useQuery<T[]>({
    queryKey,
    queryFn: async () => {
      // Temporary bypass: Fully mock the static endpoints for a complete demo
      if (table.includes("model")) {
        return [
          { id: "mdl-a1", version: "v2.1.0-prod", status: "active", created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 5).toISOString(), held_out_auc: 0.99, size_kb: 450 },
          { id: "mdl-a2", version: "v2.0.1-beta", status: "archived", created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 30).toISOString(), held_out_auc: 0.94, size_kb: 425 }
        ] as T[];
      }

      if (table.includes("telemetry") || table.includes("sandbox")) {
        return Array.from({length: 100}).map((_, i) => ({
          id: `tel-${i}`,
          recorded_at: new Date(Date.now() - i * 1000).toISOString(),
          audio_score: Math.random() * 0.4,
          vibration_score: Math.random() * 0.3,
          env_score: Math.random() * 0.1,
          gas_score: Math.random() * 0.2,
          current_score: Math.random() * 0.15,
          fused_score: Math.random() * 0.3
        })) as T[];
      }
      
      if (table.includes("summary") || table.includes("digest")) {
        return Array.from({length: 7}).map((_, i) => ({
          period_start: new Date(Date.now() - i * 1000 * 60 * 60 * 24).toISOString(),
          granularity: "day",
          avg_fused_score: Math.random() * 0.3,
          max_fused_score: 0.2 + Math.random() * 0.6,
          event_count: Math.random() > 0.7 ? 1 : 0
        })) as T[];
      }

      return [] as T[];
    },
    staleTime: Infinity,  // never auto-refetch — matches "genuinely
                            // static within a session" from the spec
  });
}
