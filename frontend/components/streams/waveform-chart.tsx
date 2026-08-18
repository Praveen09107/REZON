"use client";
import type { TelemetryRow } from "@/lib/api-client";

interface WaveformChartProps {
  data: TelemetryRow[];
  scoreKey: keyof TelemetryRow;
  label: string;
  colorVar: string;
}

// Deliberately simple SVG polyline, not a heavy charting library — a
// rolling window of ≤60 points on one modality doesn't need Recharts'
// full feature set, and a lighter implementation here keeps this page
// (which has 5 of these rendering simultaneously) genuinely responsive.
export function WaveformChart({ data, scoreKey, label, colorVar }: WaveformChartProps) {
  const values = data.map((row) => (row[scoreKey] as number) ?? 0);
  const points = values
    .map((v, i) => `${(i / Math.max(1, values.length - 1)) * 100},${48 - v * 48}`)
    .join(" ");

  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <div className="mb-2 flex items-center justify-between text-xs">
        <span className="text-text-2">{label}</span>
        <span className="text-text-3">
          {values.length > 0 ? values[values.length - 1].toFixed(2) : "—"}
        </span>
      </div>
      <svg viewBox="0 0 100 48" className="h-16 w-full" preserveAspectRatio="none">
        <polyline points={points} fill="none" stroke={colorVar} strokeWidth="1.5" />
      </svg>
    </div>
  );
}
