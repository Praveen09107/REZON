"use client";
import { scoreToColorToken } from "@/lib/score-color";
import type { TelemetryRow } from "@/lib/api-client";

interface SensorNode {
  key: keyof Pick<TelemetryRow, "audio_score" | "vibration_score" | "env_score" | "gas_score" | "current_score">;
  label: string;
  position: { top?: string; left?: string; right?: string; bottom?: string };
}

// Layout matches the approved concept mockup exactly — 4 corners +
// left-center, machine at true center.
const SENSOR_NODES: SensorNode[] = [
  { key: "audio_score", label: "Audio", position: { top: "6%", left: "12%" } },
  { key: "vibration_score", label: "Vibration", position: { top: "6%", right: "12%" } },
  { key: "gas_score", label: "Gas", position: { bottom: "8%", left: "14%" } },
  { key: "current_score", label: "Current", position: { bottom: "8%", right: "14%" } },
  { key: "env_score", label: "Environment", position: { top: "44%", left: "2%" } },
];

function pulseSpeedForScore(score: number): string {
  // Faster pulse = more elevated — a direct, continuous mapping, not
  // just a 3-color threshold jump, matching the "ambient intelligence"
  // design goal (elevation vision Pillar 2): the visual should
  // communicate degree, not just category.
  const durationSec = Math.max(0.6, 2.4 - score * 2);
  return `${durationSec}s`;
}

export function RoomVisualization({ telemetry }: { telemetry: TelemetryRow | null }) {
  return (
    <div className="relative flex h-[480px] items-center justify-center rounded-2xl border border-border bg-surface p-10">
      <div className="relative h-[380px] w-[380px]">
        <div className="absolute inset-0 rounded-3xl border border-dashed border-border" />

        <div className="absolute left-1/2 top-1/2 flex h-[70px] w-[110px] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-lg border border-calm bg-surface-2 text-xs text-text-2"
             style={{ boxShadow: "0 0 30px rgba(63,176,201,0.15)" }}>
          Monitored machine
        </div>

        {SENSOR_NODES.map((node) => {
          const score = telemetry?.[node.key] ?? 0;
          const token = scoreToColorToken(score);
          return (
            <div key={node.key} className="absolute" style={node.position}>
              <div
                className={`relative h-4 w-4 rounded-full bg-${token}`}
                style={{ animationDuration: pulseSpeedForScore(score) }}
              >
                <div
                  className={`absolute -inset-2 animate-ping rounded-full bg-${token} opacity-30`}
                  style={{ animationDuration: pulseSpeedForScore(score) }}
                />
              </div>
              <div className="mt-1 whitespace-nowrap text-[10.5px] text-text-3">{node.label}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
