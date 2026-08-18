# SESSION 15 — Sensor Streams & Activity Timeline
**Risk tier: ROUTINE.**
**Branch: `session/build-15-streams-timeline`**
**Attach: `05_FRONTEND_TECHNICAL_SPEC.md` §6-7**

---

## Agent Instructions

Two pages: Sensor Streams (live per-modality waveforms, Tier 1 real-time per Frontend Spec §6) and Activity Timeline (a unified chronological feed of everything that's happened — alerts, actuations, model updates — Tier 2 polled, since a history feed doesn't need sub-second updates).

**What this session creates:**
- `frontend/hooks/use-rolling-window.ts` — accumulates live telemetry into a client-side rolling window for charting (Realtime gives you one row at a time; charting needs recent history)
- `frontend/app/streams/page.tsx`
- `frontend/components/streams/waveform-chart.tsx`
- `frontend/app/timeline/page.tsx`
- `frontend/components/timeline/timeline-item.tsx`

---

## FILE 1: `frontend/hooks/use-rolling-window.ts`

```typescript
"use client";
import { useEffect, useState } from "react";
import { useLiveTelemetry } from "./use-live-telemetry";
import type { TelemetryRow } from "@/lib/api-client";

// Realtime subscriptions (Session 13) deliver one new row at a time —
// this hook accumulates them into a bounded client-side window,
// specifically for charting, which is a genuinely different need than
// "what's the current value" (Session 14's use case).
export function useRollingWindow(windowSize: number = 60) {
  const live = useLiveTelemetry();
  const [window, setWindow] = useState<TelemetryRow[]>([]);

  useEffect(() => {
    if (!live.data) return;
    setWindow((prev) => {
      const next = [...prev, live.data!];
      return next.length > windowSize ? next.slice(next.length - windowSize) : next;
    });
  }, [live.data]);

  return { window, connected: live.connected, lastUpdateMs: live.lastUpdateMs };
}
```

## FILE 2: `frontend/components/streams/waveform-chart.tsx`

```typescript
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
```

## FILE 3: `frontend/app/streams/page.tsx`

```typescript
"use client";
import { useRollingWindow } from "@/hooks/use-rolling-window";
import { ResilienceWrapper } from "@/components/resilience-wrapper";
import { WaveformChart } from "@/components/streams/waveform-chart";

const CHARTS: { key: "audio_score" | "vibration_score" | "env_score" | "gas_score" | "current_score"; label: string; color: string }[] = [
  { key: "audio_score", label: "Audio", color: "#3fb0c9" },
  { key: "vibration_score", label: "Vibration", color: "#a371f7" },
  { key: "env_score", label: "Environment", color: "#6e7681" },
  { key: "gas_score", label: "Gas", color: "#3fb950" },
  { key: "current_score", label: "Current", color: "#d29922" },
];

export default function StreamsPage() {
  const { window, connected, lastUpdateMs } = useRollingWindow(60);

  return (
    <ResilienceWrapper lastUpdateMs={lastUpdateMs} loading={!connected && window.length === 0}>
      <div className="grid grid-cols-2 gap-4">
        {CHARTS.map((chart) => (
          <WaveformChart key={chart.key} data={window} scoreKey={chart.key}
            label={chart.label} colorVar={chart.color} />
        ))}
      </div>
    </ResilienceWrapper>
  );
}
```

## FILE 4: `frontend/components/timeline/timeline-item.tsx`

```typescript
interface TimelineItemProps {
  timestamp: string;
  type: "alert" | "actuation" | "suppressed_debounce" | "suppressed_cooldown" | "model_update" | "calibration_milestone";
  summary: string;
}

const TYPE_STYLES: Record<string, { color: string; icon: string }> = {
  alert: { color: "text-elevated", icon: "⚠" },
  actuation: { color: "text-danger", icon: "⏻" },
  suppressed_debounce: { color: "text-text-3", icon: "○" },
  suppressed_cooldown: { color: "text-text-3", icon: "○" },
  model_update: { color: "text-calm", icon: "◈" },
  calibration_milestone: { color: "text-calm", icon: "✓" },
};

// Unified feed — deliberately includes suppressed events, not just
// fired ones, per the actuation state machine's own logging discipline
// (Firmware Spec §5): a suppressed candidate is real, useful history,
// not noise to filter out.
export function TimelineItem({ timestamp, type, summary }: TimelineItemProps) {
  const style = TYPE_STYLES[type] ?? { color: "text-text-2", icon: "•" };
  return (
    <div className="flex items-start gap-3 border-b border-border py-3 last:border-0">
      <span className={style.color}>{style.icon}</span>
      <div>
        <div className="text-sm text-text">{summary}</div>
        <div className="text-xs text-text-3">{new Date(timestamp).toLocaleString()}</div>
      </div>
    </div>
  );
}
```

## FILE 5: `frontend/app/timeline/page.tsx`

```typescript
"use client";
import { usePolledQuery } from "@/hooks/use-polled-data";
import { ResilienceWrapper } from "@/components/resilience-wrapper";
import { TimelineItem } from "@/components/timeline/timeline-item";

interface TimelineEvent {
  recorded_at: string;
  event_type: string;
  fused_score: number;
}

export default function TimelinePage() {
  const { data, isLoading, dataUpdatedAt } = usePolledQuery<TimelineEvent>(
    ["timeline"], "anomaly_events", { orderBy: "recorded_at", limit: 50 }
  );

  return (
    <ResilienceWrapper lastUpdateMs={dataUpdatedAt} loading={isLoading}>
      <div className="rounded-xl border border-border bg-surface p-4">
        {(data ?? []).map((event, i) => (
          <TimelineItem key={i} timestamp={event.recorded_at}
            type={event.event_type as TimelineEvent["event_type"]}
            summary={`${event.event_type.replace(/_/g, " ")} — fused score ${event.fused_score.toFixed(2)}`} />
        ))}
      </div>
    </ResilienceWrapper>
  );
}
```

---

## Verification Steps

**Step 1:** `npm run build` — succeeds.

**Step 2:** With real live data flowing, watch the Streams page for at least 60 real telemetry rows' worth of time — confirm each waveform genuinely scrolls (older points age out, per `useRollingWindow`'s bounded-window logic), not just accumulates unbounded.

**Step 3:** Confirm the Timeline page shows suppressed events (debounce/cooldown suppressions), not only fired alerts/actuations — insert a real `suppressed_debounce`-type row directly in Supabase, confirm it renders with the correct muted styling.

## Known open items
None.
