# SESSION 16 — Incidents: Uncertainty-Sorted List + Narrative Reconstruction
**Risk tier: ROUTINE.**
**Branch: `session/build-16-incidents`**
**Attach: `05_FRONTEND_TECHNICAL_SPEC.md` §7-8**

---

## Agent Instructions

Build the Incidents list (uncertainty-sorted, per ADD §17.3) and the detail view with the templated narrative reconstruction from Frontend Spec §8 — the honest, non-LLM answer to "AI-driven interaction" for this product.

**What this session creates:**
- `frontend/lib/generate-narrative.ts` — the real templating function
- `frontend/app/incidents/page.tsx` — list, sorted by proximity to threshold
- `frontend/app/incidents/[id]/page.tsx` — detail view
- `frontend/components/incidents/modality-breakdown.tsx`

---

## FILE 1: `frontend/lib/generate-narrative.ts`

```typescript
// Direct TypeScript port of Frontend Spec §8's exact pseudocode —
// verified against the live spec before writing, not paraphrased.
interface Incident {
  recorded_at: string;
  event_type: string;
  contributing_modalities: Record<string, number>;
}

function resultingAction(eventType: string): string {
  switch (eventType) {
    case "actuation": return "triggering a response";
    case "alert": return "triggering an alert";
    case "suppressed_debounce": return "but was suppressed as a transient spike";
    case "suppressed_cooldown": return "but was suppressed by the actuation cooldown";
    default: return "was recorded";
  }
}

export function generateNarrative(incident: Incident): string {
  const sorted = Object.entries(incident.contributing_modalities)
    .filter(([key]) => key !== "vibration_hw_confirmed")  // not a score, exclude from ranking
    .sort(([, a], [, b]) => b - a)
    .slice(0, 2);

  const modalityLabel = (key: string) =>
    key.replace("_score", "").replace(/^\w/, (c) => c.toUpperCase());

  const template = sorted.length >= 2
    ? `${modalityLabel(sorted[0][0])} and ${modalityLabel(sorted[1][0])}`
    : sorted.length === 1
    ? modalityLabel(sorted[0][0])
    : "An anomaly";

  const sustained = incident.event_type === "actuation" ? ", sustained for the debounce window," : "";
  const time = new Date(incident.recorded_at).toLocaleString();

  return `${template} crossed threshold at ${time}${sustained}, ${resultingAction(incident.event_type)}.`;
}
```

## FILE 2: `frontend/app/incidents/page.tsx`

```typescript
"use client";
import Link from "next/link";
import { usePolledQuery } from "@/hooks/use-polled-data";
import { ResilienceWrapper } from "@/components/resilience-wrapper";
import { generateNarrative } from "@/lib/generate-narrative";

interface IncidentRow {
  id: string; recorded_at: string; event_type: string;
  fused_score: number; contributing_modalities: Record<string, number>;
  human_label: string | null;
}

const RESPONSE_THRESHOLD = 0.85;  // AI/ML Spec §7.3 — the value uncertainty
                                    // is measured proximity TO

export default function IncidentsPage() {
  const { data, isLoading, dataUpdatedAt } = usePolledQuery<IncidentRow>(
    ["incidents"], "anomaly_events", { limit: 100 }
  );

  // ADD §17.3's uncertainty sort: closest to the decision boundary first —
  // computed client-side per Frontend Spec §7, ascending by |fused_score - 0.85|.
  const sorted = [...(data ?? [])].sort(
    (a, b) => Math.abs(a.fused_score - RESPONSE_THRESHOLD) - Math.abs(b.fused_score - RESPONSE_THRESHOLD)
  );

  return (
    <ResilienceWrapper lastUpdateMs={dataUpdatedAt} loading={isLoading}>
      <div className="space-y-2">
        {sorted.map((incident) => (
          <Link key={incident.id} href={`/incidents/${incident.id}`}
            className="block rounded-lg border border-border bg-surface p-4 hover:border-calm">
            <div className="flex items-center justify-between">
              <span className="text-sm text-text">{generateNarrative(incident)}</span>
              {incident.human_label === null && (
                <span className="rounded bg-surface-2 px-2 py-0.5 text-[11px] text-text-2">
                  needs review
                </span>
              )}
            </div>
          </Link>
        ))}
      </div>
    </ResilienceWrapper>
  );
}
```

## FILE 3: `frontend/components/incidents/modality-breakdown.tsx`

```typescript
import { scoreToColorToken } from "@/tailwind.config";

interface ModalityBreakdownProps {
  contributingModalities: Record<string, number>;
}

// The explainability breakdown, made visible — turning the fusion
// logic's own computed per-modality contributions (Session 7's real
// output) into something a human reads, not just logs.
export function ModalityBreakdown({ contributingModalities }: ModalityBreakdownProps) {
  const entries = Object.entries(contributingModalities)
    .filter(([key]) => key !== "vibration_hw_confirmed");
  const hwConfirmed = contributingModalities["vibration_hw_confirmed"];

  return (
    <div className="rounded-lg border border-border bg-surface-2 p-4">
      <div className="mb-2 text-xs text-text-2">Contributing modalities</div>
      {entries.map(([key, score]) => {
        const token = scoreToColorToken(score as number);
        return (
          <div key={key} className="mb-1.5 flex items-center justify-between text-sm">
            <span className="text-text-2">{key.replace("_score", "")}</span>
            <span className={`text-${token}`}>{(score as number).toFixed(2)}</span>
          </div>
        );
      })}
      {hwConfirmed !== undefined && (
        <div className="mt-2 border-t border-border pt-2 text-xs text-text-3">
          Hardware confirmation (SW-420): {hwConfirmed ? "✓ confirmed" : "⚠ not confirmed — see AI/ML Spec §7.5"}
        </div>
      )}
    </div>
  );
}
```

## FILE 4: `frontend/app/incidents/[id]/page.tsx`

```typescript
"use client";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { generateNarrative } from "@/lib/generate-narrative";
import { ModalityBreakdown } from "@/components/incidents/modality-breakdown";
import { useIsOperator } from "@/lib/auth-context";

export default function IncidentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const isOperator = useIsOperator();
  const supabase = createClient();

  const { data: incident, refetch } = useQuery({
    queryKey: ["incident", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("anomaly_events").select("*").eq("id", id).single();
      if (error) throw error;
      return data;
    },
  });

  async function label(value: "confirmed" | "false_alarm") {
    // Write path — Frontend Spec §4: real enforcement is RLS (Backend
    // Spec §2, operator-only UPDATE policy), this client-side
    // isOperator check is UX only, matching Session 11's established pattern.
    await supabase.from("anomaly_events").update({ human_label: value }).eq("id", id);
    refetch();
  }

  if (!incident) return <div className="text-text-2">Loading...</div>;

  return (
    <div className="max-w-2xl space-y-4">
      <div className="rounded-xl border border-border bg-surface p-5">
        <p className="text-text">{generateNarrative(incident)}</p>
      </div>
      <ModalityBreakdown contributingModalities={incident.contributing_modalities} />
      {isOperator && (
        <div className="flex gap-2">
          <button onClick={() => label("confirmed")}
            className="rounded bg-danger-bg px-3 py-1.5 text-sm text-danger">Confirm</button>
          <button onClick={() => label("false_alarm")}
            className="rounded bg-calm-bg px-3 py-1.5 text-sm text-calm">False alarm</button>
        </div>
      )}
    </div>
  );
}
```

---

## Verification Steps

**Step 1:** `npm run build` — succeeds.

**Step 2:** Insert 3 real test rows with `fused_score` values 0.60, 0.84, 0.95 — confirm the list orders them 0.84, 0.95, 0.60 (closest to 0.85 first), the literal test of the uncertainty-sort logic.

**Step 3:** Open a real incident detail page, confirm `generateNarrative()`'s output reads as a real sentence with the actual top-2 modalities and timestamp — not a template artifact like `"undefined and undefined"`.

**Step 4:** As a `viewer`-role test user, confirm the Confirm/False Alarm buttons don't render at all (not just disabled) — matching the operator-only pattern established in Session 11.

## Known open items
None.
