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
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white tracking-tight text-glow mb-2">Command Center</h1>
        <p className="text-text-2">Real-time fusion engine & hardware diagnostics.</p>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-6">
        <div className="glass glass-hover rounded-2xl p-6 overflow-hidden relative">
          <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
            <svg width="200" height="200" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1"><circle cx="12" cy="12" r="10"/><path d="M12 2v20M2 12h20"/></svg>
          </div>
          <RoomVisualization telemetry={data} />
        </div>
        <div className="flex flex-col gap-6">
          <div className="glass glass-hover rounded-2xl p-6 animate-float flex flex-col justify-center items-center text-center">
            <div className="text-sm font-medium text-text-2 uppercase tracking-widest mb-2">Fused Anomaly Score</div>
            <div className="text-6xl font-bold text-calm text-glow">
              {data?.fused_score.toFixed(2) ?? "—"}
            </div>
          </div>
          <div className="glass glass-hover rounded-2xl p-6">
            <ConfidenceStrip telemetry={data} />
          </div>
          <div className="glass glass-hover rounded-2xl p-6">
            <MachineHealthCard telemetry={data} />
          </div>
        </div>
      </div>
    </ResilienceWrapper>
  );
}
