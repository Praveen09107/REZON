import type { TelemetryRow } from "@/lib/api-client";

// The current modality is the only one watching the actuation target
// directly (AI/ML Spec §7.2) — surfaced here as its own card, not
// buried in the confidence strip, per Frontend Spec §7's explicit
// per-view contract.
export function MachineHealthCard({ telemetry }: { telemetry: TelemetryRow | null }) {
  const currentScore = telemetry?.current_score ?? 0;
  const isNominal = currentScore < 0.75;

  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <div className="mb-1 text-[11px] uppercase tracking-wide text-text-2">Monitored machine</div>
      <div className={`text-lg font-semibold ${isNominal ? "text-calm" : "text-elevated"}`}>
        {isNominal ? "Nominal" : "Elevated"}
      </div>
      <div className="mt-1 text-xs text-text-3">current draw score: {currentScore.toFixed(2)}</div>
    </div>
  );
}
