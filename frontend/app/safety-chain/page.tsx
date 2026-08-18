"use client";
import { useLiveTelemetry } from "@/hooks/use-live-telemetry";
import { usePolledQuery } from "@/hooks/use-polled-data";
import { ResilienceWrapper } from "@/components/resilience-wrapper";
import { PipelineStage } from "@/components/safety-chain/pipeline-stage";

const ALERT_THRESHOLD = 0.65;
const RESPONSE_THRESHOLD = 0.85;
const ELEVATED_THRESHOLD = 0.75;

interface LastEvent { event_type: string; recorded_at: string }

export default function SafetyChainPage() {
  const { data: telemetry, lastUpdateMs, connected } = useLiveTelemetry();
  const { data: recentEvents } = usePolledQuery<LastEvent>(
    ["safety-chain-last-event"], "anomaly_events", { orderBy: "recorded_at", limit: 1 }
  );
  const lastEvent = recentEvents?.[0];

  // Stages 1-2: genuinely live, computed directly from current telemetry scores.
  const fusedScore = telemetry?.fused_score ?? 0;
  const stage1Passed = fusedScore >= ALERT_THRESHOLD;
  const corroboratingCount = telemetry
    ? [telemetry.audio_score, telemetry.vibration_score, telemetry.env_score,
       telemetry.gas_score, telemetry.current_score].filter((s) => s >= ELEVATED_THRESHOLD).length
    : 0;
  const stage2Passed = fusedScore >= RESPONSE_THRESHOLD && corroboratingCount >= 2;

  // Stages 3+: last-known resolved outcome, honestly labeled — per
  // Frontend Spec §7's flagged open item, the device doesn't currently
  // report live intermediate debounce/cooldown state.
  const lastWasActuation = lastEvent?.event_type === "actuation";
  const lastWasSuppressed = lastEvent?.event_type?.startsWith("suppressed");

  if (!connected && !telemetry) {
    return (
      <div className="rounded-xl border border-border bg-surface p-6 text-center text-sm text-text-2">
        Waiting for live telemetry to establish the current safety-chain state.
      </div>
    );
  }

  return (
    <ResilienceWrapper lastUpdateMs={lastUpdateMs} loading={!connected}>
      <div className="rounded-2xl border border-border bg-surface p-9">
        <div className="mb-6 flex items-center gap-1">
          <PipelineStage number={1} label="Alert threshold" sublabel={`fused ≥ ${ALERT_THRESHOLD}`}
            status={stage1Passed ? "passed" : "idle"} />
          <PipelineStage number={2} label="Corroboration" sublabel={`${corroboratingCount} of 5 modalities`}
            status={stage2Passed ? "passed" : stage1Passed ? "active" : "idle"} />
          <PipelineStage number={3} label="Debounce" sublabel="sustained ~4s window"
            status={lastWasActuation ? "passed" : lastWasSuppressed ? "blocked" : "idle"} />
          <PipelineStage number={4} label="Cooldown" sublabel="60s since last"
            status={lastWasActuation ? "passed" : "idle"} />
          <PipelineStage number={5} label="Override check" sublabel="physical switch armed"
            status={lastWasActuation ? "passed" : "idle"} />
          <PipelineStage number={6} label="Actuate" sublabel="relay trips"
            status={lastWasActuation ? "passed" : "idle"} />
        </div>

        <div className="rounded-lg border border-border bg-surface-2 p-3 text-xs text-text-3">
          Stages 1-2 are live, computed from current sensor scores. Stages 3-6 reflect the
          most recent resolved outcome (last event: {lastEvent?.event_type ?? "none yet"}) —
          the device reports committed decisions, not live intermediate debounce progress,
          per Frontend Spec §7's documented design.
        </div>
      </div>
    </ResilienceWrapper>
  );
}
