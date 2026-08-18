# SESSION 18 — Analytics + Model & Drift
**Risk tier: ROUTINE.**
**Branch: `session/build-18-analytics-drift`**
**Attach: `05_FRONTEND_TECHNICAL_SPEC.md` §7, `03_BACKEND_CLOUD_TECHNICAL_SPEC.md` §1 (as retrofitted, `DEC-041`)**

---

## Agent Instructions

Analytics reads from `telemetry_summary` (the DEC-003 pipeline — this page is the actual reason that summary channel exists). Model & Drift reads from `model_registry` and the newly-added `drift_status` table (`DEC-041`).

**What this session creates:**
- `frontend/app/analytics/page.tsx`
- `frontend/components/analytics/heatmap.tsx`
- `frontend/app/model/page.tsx`
- `frontend/components/model/drift-row.tsx`

---

## FILE 1: `frontend/components/analytics/heatmap.tsx`

```typescript
interface HeatmapProps {
  data: { hour: number; day: number; avgScore: number }[];  // 7 days x 24 hours
}

function heatColor(score: number): string {
  if (score >= 0.85) return "#f85149";
  if (score >= 0.65) return "#d29922";
  if (score >= 0.3) return "#1f6f3f";
  return "#1c2333";
}

export function Heatmap({ data }: HeatmapProps) {
  const grid = new Map(data.map((d) => [`${d.day}-${d.hour}`, d.avgScore]));

  return (
    <div className="grid grid-cols-24 gap-[3px]">
      {Array.from({ length: 7 }).flatMap((_, day) =>
        Array.from({ length: 24 }).map((_, hour) => {
          const score = grid.get(`${day}-${hour}`) ?? 0;
          return (
            <div key={`${day}-${hour}`} className="aspect-square rounded-[2px]"
              style={{ background: heatColor(score) }}
              title={`Day ${day}, ${hour}:00 — avg ${score.toFixed(2)}`} />
          );
        })
      )}
    </div>
  );
}
```

## FILE 2: `frontend/app/analytics/page.tsx`

```typescript
"use client";
import { usePolledQuery } from "@/hooks/use-polled-data";
import { ResilienceWrapper } from "@/components/resilience-wrapper";
import { Heatmap } from "@/components/analytics/heatmap";

interface SummaryRow {
  period_start: string; granularity: string;
  avg_fused_score: number; max_fused_score: number;
  modality_attribution: Record<string, number>;
}

export default function AnalyticsPage() {
  const { data, isLoading, dataUpdatedAt } = usePolledQuery<SummaryRow>(
    ["analytics-summary"], "telemetry_summary", { orderBy: "period_start", limit: 168 }  // 7 days hourly
  );

  const hourlyRows = (data ?? []).filter((r) => r.granularity === "hour");
  const avgOverall = hourlyRows.length
    ? hourlyRows.reduce((sum, r) => sum + r.avg_fused_score, 0) / hourlyRows.length
    : 0;

  const heatmapData = hourlyRows.map((r) => {
    const d = new Date(r.period_start);
    return { day: d.getDay(), hour: d.getHours(), avgScore: r.avg_fused_score };
  });

  return (
    <ResilienceWrapper lastUpdateMs={dataUpdatedAt} loading={isLoading}>
      <div className="mb-5 grid grid-cols-4 gap-4">
        <div className="rounded-xl border border-border bg-surface p-4">
          <div className="text-xs text-text-2">Avg fused score (7d)</div>
          <div className="text-2xl font-semibold text-calm">{avgOverall.toFixed(2)}</div>
        </div>
      </div>
      <div className="rounded-xl border border-border bg-surface p-4">
        <div className="mb-3 text-xs text-text-2">Activity heatmap — hour × day</div>
        <Heatmap data={heatmapData} />
      </div>
    </ResilienceWrapper>
  );
}
```

## FILE 3: `frontend/components/model/drift-row.tsx`

```typescript
interface DriftRowProps { modality: string; psiValue: number; status: string; }

const STATUS_COLOR: Record<string, string> = {
  stable: "text-calm", watch: "text-elevated", significant: "text-danger",
};

export function DriftRow({ modality, psiValue, status }: DriftRowProps) {
  return (
    <div className="flex items-center justify-between border-b border-border py-2.5 last:border-0">
      <span className="text-sm capitalize text-text-2">{modality}</span>
      <div className="flex items-center gap-3">
        <span className="text-xs text-text-3">PSI {psiValue.toFixed(3)}</span>
        <span className={`text-sm font-medium ${STATUS_COLOR[status] ?? "text-text-2"}`}>{status}</span>
      </div>
    </div>
  );
}
```

## FILE 4: `frontend/app/model/page.tsx`

```typescript
"use client";
import { usePolledQuery } from "@/hooks/use-polled-data";
import { ResilienceWrapper } from "@/components/resilience-wrapper";
import { DriftRow } from "@/components/model/drift-row";

interface ModelRow { version: string; held_out_auc: number; status: string; }
interface DriftRow2 { modality: string; psi_value: number; status: string; }

const AUC_BAR = 0.85;  // AI/ML Spec §9 — the hard bar, restated here
                          // for display context, not re-derived

export default function ModelPage() {
  const { data: models, isLoading: modelsLoading, dataUpdatedAt } = usePolledQuery<ModelRow>(
    ["model-registry"], "model_registry", { orderBy: "created_at", limit: 1 }
  );
  const { data: drift, isLoading: driftLoading } = usePolledQuery<DriftRow2>(
    ["drift-status"], "drift_status"  // DEC-041's new table
  );

  const activeModel = models?.[0];

  return (
    <ResilienceWrapper lastUpdateMs={dataUpdatedAt} loading={modelsLoading || driftLoading}>
      <div className="mb-5 grid grid-cols-3 gap-4">
        <div className="rounded-xl border border-border bg-surface p-4">
          <div className="text-xs text-text-2">Active model</div>
          <div className="text-lg font-semibold text-text">{activeModel?.version ?? "—"}</div>
        </div>
        <div className="rounded-xl border border-border bg-surface p-4">
          <div className="text-xs text-text-2">Held-out AUC</div>
          <div className={`text-lg font-semibold ${(activeModel?.held_out_auc ?? 0) >= AUC_BAR ? "text-calm" : "text-danger"}`}>
            {activeModel?.held_out_auc?.toFixed(3) ?? "—"}
          </div>
        </div>
      </div>
      <div className="rounded-xl border border-border bg-surface p-4">
        <div className="mb-2 text-xs text-text-2">Drift monitor — per modality (weekly, Local MLOps Spec §3)</div>
        {(drift ?? []).map((d) => (
          <DriftRow key={d.modality} modality={d.modality} psiValue={d.psi_value} status={d.status} />
        ))}
      </div>
    </ResilienceWrapper>
  );
}
```

---

## Verification Steps

**Step 1:** `npm run build` — succeeds.

**Step 2:** Insert 3 real `drift_status` rows (statuses `stable`, `watch`, `significant`) — confirm each renders with the correct color, matching the same PSI-threshold color logic established in Local MLOps Spec §3.

**Step 3:** Confirm the Analytics page's heatmap genuinely reflects real `telemetry_summary` data — insert an hourly row with a high `avg_fused_score`, confirm that specific hour/day cell renders red, not just that the grid renders at all.

## Known open items
None — both pages build cleanly on the now-corrected schema.
