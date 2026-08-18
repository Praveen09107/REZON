"use client";
import { useState, useMemo } from "react";
import { useStaticQuery } from "@/hooks/use-static-data";
import { ResilienceWrapper } from "@/components/resilience-wrapper";
import { replayWithThresholds, summarizeReplay, type HypotheticalThresholds } from "@/lib/replay-fusion";
import type { TelemetryRow } from "@/lib/api-client";

// Real, signed-off defaults (AI/ML Spec §7.3) as the slider starting point.
const REAL_THRESHOLDS: HypotheticalThresholds = {
  alertThreshold: 0.65, responseThreshold: 0.85, elevatedThreshold: 0.75,
};

export default function SandboxPage() {
  const { data, isLoading, dataUpdatedAt } = useStaticQuery<TelemetryRow>(
    ["sandbox-history"], "telemetry"
  );
  const [thresholds, setThresholds] = useState<HypotheticalThresholds>(REAL_THRESHOLDS);

  const results = useMemo(
    () => replayWithThresholds(data ?? [], thresholds),
    [data, thresholds]
  );
  const summary = summarizeReplay(results);

  // Compare against what ACTUALLY happened under the real thresholds,
  // computed the same way — not a separate "real" code path, the same
  // function called with REAL_THRESHOLDS, so any difference genuinely
  // reflects the slider change, not a logic discrepancy between two
  // implementations.
  const actualResults = useMemo(
    () => replayWithThresholds(data ?? [], REAL_THRESHOLDS), [data]
  );
  const actualSummary = summarizeReplay(actualResults);

  function Slider({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
    return (
      <div className="mb-3">
        <div className="mb-1 flex justify-between text-xs text-text-2">
          <span>{label}</span><span>{value.toFixed(2)}</span>
        </div>
        <input type="range" min={0} max={1} step={0.01} value={value}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          className="w-full accent-calm" />
      </div>
    );
  }

  return (
    <ResilienceWrapper lastUpdateMs={dataUpdatedAt} loading={isLoading}>
      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-5">
        <div className="rounded-xl border border-border bg-surface p-4">
          <div className="mb-3 text-xs uppercase tracking-wide text-text-2">Hypothetical thresholds</div>
          <Slider label="Alert threshold" value={thresholds.alertThreshold}
            onChange={(v) => setThresholds((t) => ({ ...t, alertThreshold: v }))} />
          <Slider label="Response threshold" value={thresholds.responseThreshold}
            onChange={(v) => setThresholds((t) => ({ ...t, responseThreshold: v }))} />
          <Slider label="Elevated (per-modality)" value={thresholds.elevatedThreshold}
            onChange={(v) => setThresholds((t) => ({ ...t, elevatedThreshold: v }))} />
          <button onClick={() => setThresholds(REAL_THRESHOLDS)}
            className="mt-2 w-full rounded bg-surface-2 px-3 py-1.5 text-xs text-text-2">
            Reset to real thresholds
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="rounded-xl border border-border bg-surface p-4">
            <div className="mb-2 text-xs text-text-2">Actual (real thresholds)</div>
            <div className="text-2xl font-semibold text-text">{actualSummary.hypotheticalActuationCandidates}</div>
            <div className="text-xs text-text-3">actuation candidates, {actualSummary.hypotheticalAlerts} alerts, {actualSummary.totalRows} rows analyzed</div>
          </div>
          <div className="rounded-xl border border-calm bg-surface p-4">
            <div className="mb-2 text-xs text-text-2">Hypothetical (your sliders)</div>
            <div className="text-2xl font-semibold text-calm">{summary.hypotheticalActuationCandidates}</div>
            <div className="text-xs text-text-3">actuation candidates, {summary.hypotheticalAlerts} alerts</div>
          </div>
        </div>
      </div>
    </ResilienceWrapper>
  );
}
