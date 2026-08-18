# SESSION 17 — Safety Chain Monitor
**Risk tier: ROUTINE (frontend) — but represents safety-critical firmware logic, so accuracy about what's genuinely live vs. last-known matters more here than on a typical page.**
**Branch: `session/build-17-safety-chain`**
**Attach: `05_FRONTEND_TECHNICAL_SPEC.md` §7 (Safety Chain Monitor contract + its flagged open item), `02_FIRMWARE_RTOS_TECHNICAL_SPEC.md` §5**

---

## Agent Instructions

Build the visual pipeline from the approved concept mockup — but honestly, respecting the real data constraint Frontend Spec §7 already flagged: the device reports committed events only (alert/actuation/suppressed), not live intermediate debounce-counting state. This session does NOT invent live step-by-step animation the data can't actually support — stages 1-2 (threshold, corroboration) are genuinely live from telemetry scores; stages 3+ (debounce, cooldown, override, actuate) show the most recent resolved outcome, clearly labeled as such.

**What this session creates:**
- `frontend/components/safety-chain/pipeline-stage.tsx`
- `frontend/app/safety-chain/page.tsx`

---

## FILE 1: `frontend/components/safety-chain/pipeline-stage.tsx`

```typescript
interface PipelineStageProps {
  number: number;
  label: string;
  sublabel: string;
  status: "passed" | "active" | "idle" | "blocked";
}

const STATUS_STYLES: Record<PipelineStageProps["status"], string> = {
  passed: "border-calm text-calm bg-calm-bg",
  active: "border-elevated text-elevated bg-elevated-bg shadow-[0_0_0_6px_rgba(224,160,48,0.12)]",
  blocked: "border-danger text-danger bg-danger-bg",
  idle: "border-border text-text-3 bg-surface-2",
};

export function PipelineStage({ number, label, sublabel, status }: PipelineStageProps) {
  return (
    <div className="flex-1 text-center">
      <div className={`mx-auto mb-2 flex h-14 w-14 items-center justify-center rounded-full border-2 ${STATUS_STYLES[status]}`}>
        {number}
      </div>
      <div className="text-xs font-medium text-text">{label}</div>
      <div className="mx-auto mt-0.5 max-w-[110px] text-[10.5px] text-text-3">{sublabel}</div>
    </div>
  );
}
```

## FILE 2: `frontend/app/safety-chain/page.tsx`

```typescript
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
```

---

## Verification Steps

**Step 1:** `npm run build` — succeeds.

**Step 2:** With real telemetry at a low fused score, confirm stages 1-2 show "idle." Manually insert telemetry with `fused_score: 0.9` and 3 modality scores ≥ 0.75 — confirm stages 1-2 both flip to "passed" within one Realtime update, genuinely live.

**Step 3:** Insert a real `suppressed_debounce` event — confirm stage 3 shows "blocked" (red), stages 4-6 stay "idle," and the honesty note correctly names the last event type.

**Step 4 — the honesty check, worth doing deliberately:** confirm the explanatory note at the bottom is actually readable and accurate, not an afterthought — this page representing safety logic means overclaiming liveness it doesn't have would be worse here than on almost any other page in the app.

## Known open items
🔴 (Inherited from Frontend Spec §7, not new) if a future session decides the device SHOULD report live intermediate debounce state, this page's stages 3-6 logic would need real rework — noted here so that decision, if made, doesn't get treated as a routine change.
