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
      const supabase = createClient();
      const { data, error } = await supabase.from(table).select("*");
      if (error) throw error;
      return data as T[];
    },
    staleTime: Infinity,  // never auto-refetch — matches "genuinely
                            // static within a session" from the spec
  });
}
