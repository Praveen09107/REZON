import { scoreToColorToken } from "@/lib/score-color";
import type { TelemetryRow } from "@/lib/api-client";

const MODALITIES: { key: keyof TelemetryRow; label: string }[] = [
  { key: "audio_score", label: "Audio" },
  { key: "vibration_score", label: "Vibration" },
  { key: "env_score", label: "Environment" },
  { key: "gas_score", label: "Gas" },
  { key: "current_score", label: "Current" },
];

// Persistent, always visible — elevation vision Pillar 2's explicit
// requirement: ambient confidence, not a bar chart you only see after
// an alert already fired.
export function ConfidenceStrip({ telemetry }: { telemetry: TelemetryRow | null }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <div className="mb-3 text-[11px] uppercase tracking-wide text-text-2">
        Live confidence — ambient
      </div>
      {MODALITIES.map((m) => {
        const score = (telemetry?.[m.key] as number) ?? 0;
        const token = scoreToColorToken(score);
        return (
          <div key={m.key} className="mb-2 flex items-center gap-2.5">
            <span className="w-20 text-xs text-text-2">{m.label}</span>
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-2">
              <div className={`h-full rounded-full bg-${token}`} style={{ width: `${score * 100}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
