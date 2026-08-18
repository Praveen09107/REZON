"use client";
import { useLiveTelemetry } from "@/hooks/use-live-telemetry";
import { ResilienceWrapper } from "@/components/resilience-wrapper";
import { RoomVisualization } from "@/components/digital-twin/room-visualization";
import { ConfidenceStrip } from "@/components/digital-twin/confidence-strip";
import { MachineHealthCard } from "@/components/digital-twin/machine-health-card";

export default function HomePage() {
  const { data, lastUpdateMs, connected } = useLiveTelemetry();

  return (
    <ResilienceWrapper lastUpdateMs={lastUpdateMs} loading={!connected && data === null}>
      <div className="grid grid-cols-[2fr_1fr] gap-5">
        <RoomVisualization telemetry={data} />
        <div className="flex flex-col gap-4">
          <div className="rounded-xl border border-border bg-surface p-5">
            <div className="text-xs text-text-2">Fused anomaly score</div>
            <div className="text-3xl font-semibold text-calm">
              {data?.fused_score.toFixed(2) ?? "—"}
            </div>
          </div>
          <ConfidenceStrip telemetry={data} />
          <MachineHealthCard telemetry={data} />
        </div>
      </div>
    </ResilienceWrapper>
  );
}
