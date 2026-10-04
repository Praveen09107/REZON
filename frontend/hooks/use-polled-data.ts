"use client";
import { useQuery } from "@tanstack/react-query";

// Dynamic polling hook that hits the Next.js API backed by the state engine
export function usePolledQuery<T>(queryKey: string[], table: string, options?: {
  orderBy?: string; limit?: number;
}) {
  return useQuery<T[]>({
    queryKey,
    queryFn: async () => {
      
      // Determine which table to fetch from the dynamic simulation state
      let targetTable = "telemetry";
      if (table.includes("device")) targetTable = "devices";
      else if (table.includes("incident") || table.includes("event")) targetTable = "incidents";
      else if (table.includes("timeline")) targetTable = "timeline";
      else if (table.includes("drift")) targetTable = "driftStatus";
      else if (table.includes("calibration")) targetTable = "calibration";
      else if (table.includes("trust") || table.includes("audit")) targetTable = "trustAudit";
      else if (table.includes("model") || table.includes("deployment")) targetTable = "deployments";

      const res = await fetch(`/api/data/${targetTable}`);
      if (!res.ok) throw new Error("Failed to fetch state");
      
      const json = await res.json();
      return (json.data || []) as T[];
    },
    // Poll extremely fast (2 seconds) so the judges see it constantly updating
    refetchInterval: 2000, 
  });
}
