"use client";
import Link from "next/link";
import { usePolledQuery } from "@/hooks/use-polled-data";
import { ResilienceWrapper } from "@/components/resilience-wrapper";
import { generateNarrative } from "@/lib/generate-narrative";

interface IncidentRow {
  id: string; recorded_at: string; event_type: string;
  fused_score: number; contributing_modalities: Record<string, number>;
  human_label: string | null;
}

const RESPONSE_THRESHOLD = 0.85;  // AI/ML Spec §7.3 — the value uncertainty
                                    // is measured proximity TO

export default function IncidentsPage() {
  const { data, isLoading, dataUpdatedAt } = usePolledQuery<IncidentRow>(
    ["incidents"], "anomaly_events", { limit: 100 }
  );

  // ADD §17.3's uncertainty sort: closest to the decision boundary first —
  // computed client-side per Frontend Spec §7, ascending by |fused_score - 0.85|.
  const sorted = [...(data ?? [])].sort(
    (a, b) => Math.abs(a.fused_score - RESPONSE_THRESHOLD) - Math.abs(b.fused_score - RESPONSE_THRESHOLD)
  );

  function safeNarrative(incident: IncidentRow): string {
    if (!incident.contributing_modalities || Object.keys(incident.contributing_modalities).length === 0) {
      return `An anomaly was recorded at ${new Date(incident.recorded_at).toLocaleString()} — detailed breakdown unavailable.`;
    }
    return generateNarrative(incident as any);
  }

  // Empty-state (zero incidents ever, not a loading/error condition):
  if (!isLoading && sorted.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-surface p-6 text-center text-sm text-text-2">
        No incidents recorded yet — this is expected for a newly-deployed device.
      </div>
    );
  }

  return (
    <ResilienceWrapper lastUpdateMs={dataUpdatedAt} loading={isLoading}>
      <div className="space-y-2">
        {sorted.map((incident) => (
          <Link key={incident.id} href={`/incidents/${incident.id}`}
            className="block rounded-lg border border-border bg-surface p-4 hover:border-calm">
            <div className="flex items-center justify-between">
              <span className="text-sm text-text">{safeNarrative(incident)}</span>
              {incident.human_label === null && (
                <span className="rounded bg-surface-2 px-2 py-0.5 text-[11px] text-text-2">
                  needs review
                </span>
              )}
            </div>
          </Link>
        ))}
      </div>
    </ResilienceWrapper>
  );
}
