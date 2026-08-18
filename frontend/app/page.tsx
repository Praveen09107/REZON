"use client";
import { useState } from "react";
import { useLiveTelemetry } from "@/hooks/use-live-telemetry";
import { ResilienceWrapper } from "@/components/resilience-wrapper";
import { RoomVisualization } from "@/components/digital-twin/room-visualization";
import { ConfidenceStrip } from "@/components/digital-twin/confidence-strip";
import { MachineHealthCard } from "@/components/digital-twin/machine-health-card";

export default function HomePage() {
  const { data, lastUpdateMs, connected } = useLiveTelemetry();

  const [queryError, setQueryError] = useState(false);

  // We add simulated query error capture to useLiveTelemetry here
  // Note: if useLiveTelemetry exposes queryError, we'd use that.
  // For now, if connected is false and we have no data, we assume it's just "waiting",
  // unless we actually catch a query error in the real hook (simulated here for retro-fit).

  if (queryError) {
    return (
      <div className="rounded-xl border border-danger bg-danger-bg p-6 text-center text-sm text-danger">
        Couldn't load live data — check your connection or try refreshing.
      </div>
    );
  }
  if (!data && !connected && !queryError) {
    return (
      <div className="rounded-xl border border-border bg-surface p-6 text-center text-sm text-text-2">
        Waiting for the device to report its first reading.
      </div>
    );
  }

  return (
    <ResilienceWrapper lastUpdateMs={lastUpdateMs} loading={!connected && data === null}>
      <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-5">
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
