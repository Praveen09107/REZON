# SESSION 26 — Public Status Page
**Risk tier: ROUTINE — but this is the one page a stranger with no account can visit, so its failure modes get real, specific attention, not just the shared wrapper.**
**Branch: `session/build-26-public-status`**
**Attach: `05_FRONTEND_TECHNICAL_SPEC.md` §3, §5, `03_BACKEND_CLOUD_TECHNICAL_SPEC.md` §3.3 (Supabase's 7-day pause behavior)**

---

## Agent Instructions

Build the `/status` route with its own layout entirely (no sidebar, no auth) — and, per the depth standard from here forward, handle its real distinct failure modes explicitly rather than leaning only on the shared resilience wrapper. This page has three genuinely different "nothing to show" situations, and they mean different things to a visitor: *no device deployed yet*, *the query itself failed*, and *the Supabase project is paused*. Conflating them into one generic error message would actively mislead whoever's looking at this page.

**What this session creates:**
- `frontend/app/status/layout.tsx` — the standalone layout (no `AppShell`, resolves Session 12's flagged open item)
- `frontend/app/status/page.tsx`
- `frontend/components/status/status-states.tsx` — the three distinct real states, built out properly

---

## FILE 1: `frontend/app/status/layout.tsx`

```typescript
// Deliberately does NOT import AppShell (Session 12) — this route
// needs to render with zero auth dependency and zero sidebar, per
// Frontend Spec §5. Closes Session 12's flagged open item about
// route-group separation, now that this page's real structure exists
// to build that separation around.
export default function StatusLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-bg p-6">
      {children}
    </div>
  );
}
```

## FILE 2: `frontend/components/status/status-states.tsx`

```typescript
// Three genuinely distinct situations, not one generic "no data" catch-all —
// per the developer's explicit request for real per-component edge-case
// handling, not just the shared resilience wrapper's stale/disconnected logic.

export function NoDeviceYetState() {
  // The query succeeded, RLS worked, Supabase is up — there is simply
  // no telemetry_summary data yet, because the device hasn't completed
  // enough of burn-in to have pushed a summary (DEC-003's pipeline runs
  // on the local scheduled script's own cadence, which needs real data
  // to exist first). This is a NORMAL, expected early-project state,
  // not an error — the copy reflects that distinction.
  return (
    <div className="max-w-sm rounded-xl border border-border bg-surface p-6 text-center">
      <div className="mb-2 text-2xl">◔</div>
      <p className="text-sm text-text-2">
        This device is still learning its space. Status will appear here
        once initial data collection completes.
      </p>
    </div>
  );
}

export function QueryFailedState({ onRetry }: { onRetry: () => void }) {
  // The query itself errored — a real network/permission/schema problem,
  // NOT "no data exists yet." Conflating this with NoDeviceYetState would
  // hide an actual bug behind reassuring copy, which is worse than a
  // plain error message.
  return (
    <div className="max-w-sm rounded-xl border border-danger bg-danger-bg p-6 text-center">
      <div className="mb-2 text-2xl text-danger">⚠</div>
      <p className="mb-3 text-sm text-danger">
        Couldn't load status right now.
      </p>
      <button onClick={onRetry} className="rounded bg-surface px-3 py-1.5 text-xs text-text-2">
        Try again
      </button>
    </div>
  );
}

export function ProjectPausedLikelyState() {
  // Specific to this project's real, documented constraint (Backend
  // Spec §3.3): Supabase's free tier pauses after 7 days of total
  // inactivity. A public visitor hitting this page during a pause
  // shouldn't see a generic error — the honest, specific explanation
  // is more useful and more honest about a known, accepted limitation.
  return (
    <div className="max-w-sm rounded-xl border border-elevated bg-elevated-bg p-6 text-center">
      <div className="mb-2 text-2xl text-elevated">○</div>
      <p className="text-sm text-elevated">
        This status page may be temporarily paused due to inactivity.
        Check back shortly.
      </p>
    </div>
  );
}
```

## FILE 3: `frontend/app/status/page.tsx`

```typescript
"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { NoDeviceYetState, QueryFailedState, ProjectPausedLikelyState } from "@/components/status/status-states";

type PageState = "loading" | "ok" | "no-device-yet" | "query-failed" | "paused-likely";

interface LatestSummary { avg_fused_score: number; period_start: string; }

export default function PublicStatusPage() {
  const [state, setState] = useState<PageState>("loading");
  const [summary, setSummary] = useState<LatestSummary | null>(null);

  async function load() {
    setState("loading");
    const supabase = createClient();
    try {
      const { data, error } = await supabase
        .from("telemetry_summary")
        .select("avg_fused_score, period_start")
        .order("period_start", { ascending: false })
        .limit(1);

      if (error) {
        // Distinguish a likely-paused-project error (Supabase returns a
        // specific error class for this) from a genuine query failure —
        // 🟡 the exact error code/message to match on needs confirming
        // against Supabase's real current error format during
        // implementation, not assumed here.
        const looksLikePause = error.message?.toLowerCase().includes("paused")
          || error.code === "PGRST000";
        setState(looksLikePause ? "paused-likely" : "query-failed");
        return;
      }

      if (!data || data.length === 0) {
        setState("no-device-yet");
        return;
      }

      // Guard against malformed data — a row existing doesn't guarantee
      // avg_fused_score isn't null (e.g., a partially-written row from
      // an interrupted summary push). Real guard, not an assumption
      // the schema's NOT NULL constraint always holds at read time.
      if (data[0].avg_fused_score === null || data[0].avg_fused_score === undefined) {
        setState("query-failed");
        return;
      }

      setSummary(data[0]);
      setState("ok");
    } catch {
      setState("query-failed");
    }
  }

  useEffect(() => { load(); }, []);

  if (state === "loading") {
    return <div className="h-24 w-64 animate-pulse rounded-xl bg-surface-2" />;
  }
  if (state === "no-device-yet") return <NoDeviceYetState />;
  if (state === "query-failed") return <QueryFailedState onRetry={load} />;
  if (state === "paused-likely") return <ProjectPausedLikelyState />;

  const isNormal = (summary?.avg_fused_score ?? 0) < 0.65;
  return (
    <div className="max-w-sm rounded-xl border border-border bg-surface p-6 text-center">
      <div className={`mb-2 text-2xl ${isNormal ? "text-calm" : "text-elevated"}`}>
        {isNormal ? "●" : "◐"}
      </div>
      <p className="text-sm text-text">
        {isNormal ? "Currently normal" : "Recent activity detected"}
      </p>
      <p className="mt-1 text-xs text-text-3">
        Last updated {new Date(summary!.period_start).toLocaleString()}
      </p>
    </div>
  );
}
```

---

## Verification Steps

**Step 1:** `npm run build` — succeeds.

**Step 2 (each real state, individually, not just the happy path):**
- With an empty `telemetry_summary` table, confirm `NoDeviceYetState` renders — the calm, non-alarming copy, not an error.
- Temporarily break the Supabase URL (real misconfiguration), confirm `QueryFailedState` renders with a working retry button that actually re-attempts the query.
- Insert a row with `avg_fused_score: null` directly (bypassing the schema's NOT NULL if your test setup allows it, or simulate the malformed-data branch directly) — confirm the malformed-data guard catches it rather than rendering `NaN` or crashing.

**Step 3:** Confirm this page renders with zero sidebar, zero auth check, and zero network calls to anything except the public-safe `telemetry_summary` query — verify via browser dev tools' network tab that no other Supabase table is ever queried from this page.

## Known open items
🔴 The exact Supabase error signature for a paused project needs confirming against the real, current API behavior during implementation — the matching logic here is a reasonable starting guess, not verified against a real paused project yet.
