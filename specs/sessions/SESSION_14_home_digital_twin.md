# SESSION 14 — Home Page: The Digital Twin
**Risk tier: ROUTINE (frontend, no safety-critical logic) — but this is the product's single most important screen, treated with commensurate care regardless of formal risk tier.**
**Branch: `session/build-14-home-digital-twin`**
**Attach: `05_FRONTEND_TECHNICAL_SPEC.md` §7, `specs/frontend-research/FRONTEND_ELEVATION_VISION.md` (Pillar 1), the approved concept mockup**

---

## Agent Instructions

Build the real Home page — the digital twin visualization that replaces the old card-grid concept entirely, per the approved elevation vision. This is the first page consuming Session 13's live-telemetry hook for real, and the first real implementation of the score-to-visual mapping established in Session 10.

**What this session creates:**
- `frontend/app/page.tsx` — the real Home route
- `frontend/components/digital-twin/room-visualization.tsx` — the core visual (machine + 5 sensor pulse points)
- `frontend/components/digital-twin/confidence-strip.tsx`
- `frontend/components/digital-twin/machine-health-card.tsx`

---

## FILE 1: `frontend/components/digital-twin/room-visualization.tsx`

```typescript
"use client";
import { scoreToColorToken } from "@/tailwind.config";
import type { TelemetryRow } from "@/lib/api-client";

interface SensorNode {
  key: keyof Pick<TelemetryRow, "audio_score" | "vibration_score" | "env_score" | "gas_score" | "current_score">;
  label: string;
  position: { top: string; left?: string; right?: string; bottom?: string };
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
```

## FILE 2: `frontend/components/digital-twin/confidence-strip.tsx`

```typescript
import { scoreToColorToken } from "@/tailwind.config";
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
```

## FILE 3: `frontend/components/digital-twin/machine-health-card.tsx`

```typescript
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
```

## FILE 4: `frontend/app/page.tsx`

```typescript
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
```

---

## Verification Steps

**Step 1:** `npm run build` — succeeds.

**Step 2 (real, live):** with a real device (or a script simulating its exact `/ingest` payload shape from Backend Spec §3.1) sending real data, confirm the pulse animation speed genuinely changes as scores change — not just that a number updates, but that the pulse *rate* visibly responds, since that continuous mapping is this page's actual design point, not a decoration.

**Step 3:** Manually insert a `telemetry` row with `gas_score: 0.9` — confirm the gas sensor node renders in the danger color and pulses visibly faster than the calm nodes, matching `scoreToColorToken`'s exact thresholds from Session 10.

**Step 4:** Disconnect network — confirm the resilience wrapper's stale/disconnected states apply to this page correctly (Session 13's shared component, now exercised for real on the page that matters most).

## Known open items
None — builds cleanly on Sessions 10-13.
