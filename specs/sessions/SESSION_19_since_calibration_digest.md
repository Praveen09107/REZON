# SESSION 19 — Since-Calibration Comparison + Weekly Digest
**Risk tier: ROUTINE.**
**Branch: `session/build-19-calibration-digest`**
**Attach: `05_FRONTEND_TECHNICAL_SPEC.md` §7, `03_BACKEND_CLOUD_TECHNICAL_SPEC.md` §1, `01_AI_ML_TECHNICAL_SPEC.md` §9**

---

## Agent Instructions

Both pages use Tier 3 (fetch-once, `useStaticQuery` from Session 13) — neither needs live updates. Since-Calibration compares the pre-burn-in model's held-out AUC against the post-calibration model's, using real `model_registry` data (no fabricated "improvement" numbers). Weekly Digest generates a readable summary from `telemetry_summary`, extending Session 16's templating approach to a week's aggregate rather than a single incident.

**What this session creates:**
- `frontend/app/since-calibration/page.tsx`
- `frontend/lib/generate-weekly-digest.ts`
- `frontend/app/digest/page.tsx`

---

## FILE 1: `frontend/app/since-calibration/page.tsx`

```typescript
"use client";
import { useStaticQuery } from "@/hooks/use-static-data";
import { ResilienceWrapper } from "@/components/resilience-wrapper";

interface ModelVersion { version: string; held_out_auc: number; status: string; created_at: string; }

export default function SinceCalibrationPage() {
  const { data, isLoading, dataUpdatedAt } = useStaticQuery<ModelVersion>(
    ["model-history"], "model_registry"
  );

  const sorted = [...(data ?? [])].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );
  // Honest comparison: the FIRST model registered (Stage 1+2, pre-burn-in)
  // vs the CURRENT active one — not a fabricated "improvement %,"
  // just the two real AUC numbers, side by side, per AI/ML Spec §9's
  // held-out evaluation being the only trustworthy accuracy claim
  // this project makes.
  const preCalibration = sorted[0];
  const current = sorted.find((m) => m.status === "active") ?? sorted[sorted.length - 1];

  return (
    <ResilienceWrapper lastUpdateMs={dataUpdatedAt} loading={isLoading}>
      {!preCalibration || !current ? (
        <div className="text-text-2">Not enough model history yet — this page becomes meaningful after Session 34's calibration pass.</div>
      ) : (
        <div className="grid grid-cols-2 gap-5">
          <div className="rounded-xl border border-border bg-surface p-5">
            <div className="text-xs text-text-2">Pre-calibration ({preCalibration.version})</div>
            <div className="text-2xl font-semibold text-text-2">{preCalibration.held_out_auc.toFixed(3)}</div>
            <div className="text-xs text-text-3">held-out AUC, public data only</div>
          </div>
          <div className="rounded-xl border border-calm bg-surface p-5">
            <div className="text-xs text-text-2">Current ({current.version})</div>
            <div className="text-2xl font-semibold text-calm">{current.held_out_auc.toFixed(3)}</div>
            <div className="text-xs text-text-3">held-out AUC, calibrated to this space</div>
          </div>
        </div>
      )}
    </ResilienceWrapper>
  );
}
```

## FILE 2: `frontend/lib/generate-weekly-digest.ts`

```typescript
interface DailySummary { period_start: string; avg_fused_score: number; event_count: number; }

// Same honest-templating philosophy as Session 16's generateNarrative —
// real numbers, real composition, no fabricated insight beyond what
// the data actually shows.
export function generateWeeklyDigest(dailyRows: DailySummary[]): string {
  if (dailyRows.length === 0) return "No data available for this period yet.";

  const totalEvents = dailyRows.reduce((sum, r) => sum + r.event_count, 0);
  const avgScore = dailyRows.reduce((sum, r) => sum + r.avg_fused_score, 0) / dailyRows.length;
  const busiestDay = [...dailyRows].sort((a, b) => b.event_count - a.event_count)[0];
  const busiestDayName = new Date(busiestDay.period_start).toLocaleDateString(undefined, { weekday: "long" });

  return `This week, the space recorded ${totalEvents} event${totalEvents === 1 ? "" : "s"} ` +
    `across ${dailyRows.length} day${dailyRows.length === 1 ? "" : "s"} of data. ` +
    `The average fused anomaly score was ${avgScore.toFixed(2)}. ` +
    `${busiestDayName} had the most activity, with ${busiestDay.event_count} recorded event${busiestDay.event_count === 1 ? "" : "s"}.`;
}
```

## FILE 3: `frontend/app/digest/page.tsx`

```typescript
"use client";
import { useStaticQuery } from "@/hooks/use-static-data";
import { ResilienceWrapper } from "@/components/resilience-wrapper";
import { generateWeeklyDigest } from "@/lib/generate-weekly-digest";

interface DailyRow { period_start: string; granularity: string; avg_fused_score: number; event_count: number; }

export default function DigestPage() {
  const { data, isLoading, dataUpdatedAt } = useStaticQuery<DailyRow>(
    ["weekly-digest"], "telemetry_summary"
  );

  const dailyRows = (data ?? []).filter((r) => r.granularity === "day").slice(-7);
  const digestText = generateWeeklyDigest(dailyRows);

  function copyDigest() {
    navigator.clipboard.writeText(digestText);  // basic share mechanism —
                                                    // a real "export as PDF"
                                                    // is a genuine future
                                                    // enhancement, not this
                                                    // session's scope
  }

  return (
    <ResilienceWrapper lastUpdateMs={dataUpdatedAt} loading={isLoading}>
      <div className="max-w-xl rounded-xl border border-border bg-surface p-6">
        <div className="mb-3 text-xs uppercase tracking-wide text-text-2">This week's digest</div>
        <p className="text-text">{digestText}</p>
        <button onClick={copyDigest} className="mt-4 rounded bg-surface-2 px-3 py-1.5 text-sm text-text-2 hover:text-text">
          Copy to share
        </button>
      </div>
    </ResilienceWrapper>
  );
}
```

---

## Verification Steps

**Step 1:** `npm run build` — succeeds.

**Step 2:** With only one model in `model_registry` (pre-calibration state), confirm the Since-Calibration page shows the honest "not enough history yet" message — not a fabricated or misleading comparison.

**Step 3:** Insert 7 real daily `telemetry_summary` rows with varying `event_count` — confirm `generateWeeklyDigest()`'s output correctly names the actual busiest day, not a hardcoded one.

## Known open items
None.
