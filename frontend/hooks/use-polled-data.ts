"use client";
import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";

// Tier 2 (Frontend Spec §6): Incidents, Analytics, Model & Drift, Device.
// 20s interval — inside the spec's stated 15-30s range, a reasonable
// mid-point default.
export function usePolledQuery<T>(queryKey: string[], table: string, options?: {
  orderBy?: string; limit?: number;
}) {
  return useQuery<T[]>({
    queryKey,
    queryFn: async () => {
      const supabase = createClient();
      let query = supabase.from(table).select("*");
      if (options?.orderBy) query = query.order(options.orderBy, { ascending: false });
      if (options?.limit) query = query.limit(options.limit);
      const { data, error } = await query;
      if (error) throw error;
      return data as T[];
    },
    refetchInterval: 20_000,
  });
}
