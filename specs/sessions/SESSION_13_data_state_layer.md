# SESSION 13 — Data & State Layer
**Risk tier: ROUTINE.**
**Branch: `session/build-13-data-state`**
**Attach: `05_FRONTEND_TECHNICAL_SPEC.md` §6, §10**

---

## Agent Instructions

Build the real data layer implementing Frontend Spec §6's three-tier strategy properly — Session 12's toast subscription was a one-off; this session builds the reusable hooks every page from Session 15 onward actually uses. Also implements §10's resilience states (stale/disconnected/skeleton) as a shared wrapper, not per-page logic.

**What this session creates:**
- `frontend/lib/react-query-provider.tsx` — QueryClient setup
- `frontend/hooks/use-live-telemetry.ts` — Realtime-subscription tier (Home, Streams, Safety Chain)
- `frontend/hooks/use-polled-data.ts` — 15-30s polling tier (Incidents, Analytics, Model & Drift, Device)
- `frontend/hooks/use-static-data.ts` — fetch-on-nav tier (Since-Calibration, Digest, Trust Audit, Settings, Access)
- `frontend/components/resilience-wrapper.tsx` — the shared stale/disconnected/skeleton logic

---

## FILE 1: `frontend/lib/react-query-provider.tsx`

```typescript
"use client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, ReactNode } from "react";

export function ReactQueryProvider({ children }: { children: ReactNode }) {
  const [client] = useState(() => new QueryClient({
    defaultOptions: { queries: { retry: 1, staleTime: 10_000 } },
  }));
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
```

## FILE 2: `frontend/hooks/use-live-telemetry.ts`

```typescript
"use client";
import { useEffect, useState, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { getLatestTelemetry, type TelemetryRow } from "@/lib/api-client";

interface LiveTelemetryState {
  data: TelemetryRow | null;
  lastUpdateMs: number | null;   // for the resilience wrapper (FILE 5)
  connected: boolean;
}

// Tier 1 (Frontend Spec §6): Home, Sensor Streams, Safety Chain Monitor.
// Push-based, matching the ~1s device fusion cycle — no polling delay.
export function useLiveTelemetry(): LiveTelemetryState {
  const [state, setState] = useState<LiveTelemetryState>({
    data: null, lastUpdateMs: null, connected: false,
  });
  const supabase = useRef(createClient());

  useEffect(() => {
    getLatestTelemetry().then((row) => {
      if (row) setState({ data: row, lastUpdateMs: Date.now(), connected: true });
    });

    const channel = supabase.current
      .channel("live-telemetry")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "telemetry" },
          (payload) => {
            setState({ data: payload.new as TelemetryRow, lastUpdateMs: Date.now(), connected: true });
          })
      .subscribe((status) => {
        setState((prev) => ({ ...prev, connected: status === "SUBSCRIBED" }));
      });

    return () => { channel.unsubscribe(); };
  }, []);

  return state;
}
```

## FILE 3: `frontend/hooks/use-polled-data.ts`

```typescript
"use client";
import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";

// Tier 2 (Frontend Spec §6): Incidents, Analytics, Model & Drift, Device.
// 20s interval — inside the spec's stated 15-30s range, a reasonable
// mid-point default.
export function usePolledQuery<T>(queryKey: string[], table: string, options?: {
  orderBy?: string; limit?: number;
}) {
  return useQuery<T[]>({
    queryKey,
    queryFn: async () => {
      const supabase = createClient();
      let query = supabase.from(table).select("*");
      if (options?.orderBy) query = query.order(options.orderBy, { ascending: false });
      if (options?.limit) query = query.limit(options.limit);
      const { data, error } = await query;
      if (error) throw error;
      return data as T[];
    },
    refetchInterval: 20_000,
  });
}
```

## FILE 4: `frontend/hooks/use-static-data.ts`

```typescript
"use client";
import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";

// Tier 3 (Frontend Spec §6): Since-Calibration, Digest, Trust Audit,
// Settings, Access. Fetch-on-mount only — no refetchInterval at all,
// the deliberate difference from Tier 2, not an oversight.
export function useStaticQuery<T>(queryKey: string[], table: string) {
  return useQuery<T[]>({
    queryKey,
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase.from(table).select("*");
      if (error) throw error;
      return data as T[];
    },
    staleTime: Infinity,  // never auto-refetch — matches "genuinely
                            // static within a session" from the spec
  });
}
```

## FILE 5: `frontend/components/resilience-wrapper.tsx`

```typescript
"use client";
import { ReactNode } from "react";

// Frontend Spec §10's exact three-state logic, made concrete once
// here rather than reimplemented per page — the antidote to "the
// classic demo-day embarrassment" named explicitly in that section.
interface ResilienceWrapperProps {
  lastUpdateMs: number | null;
  loading: boolean;
  children: ReactNode;
}

export function ResilienceWrapper({ lastUpdateMs, loading, children }: ResilienceWrapperProps) {
  if (loading && lastUpdateMs === null) {
    return <div className="animate-pulse rounded-lg bg-surface-2 h-40" />;  // skeleton, never blank
  }

  const ageMs = lastUpdateMs ? Date.now() - lastUpdateMs : Infinity;

  return (
    <div>
      {ageMs > 5 * 60_000 && (
        <div className="mb-3 rounded-md border border-danger bg-danger-bg px-3 py-2 text-sm text-danger">
          Connection lost — showing last known data
        </div>
      )}
      {ageMs > 60_000 && ageMs <= 5 * 60_000 && (
        <div className="mb-3 rounded-md border border-elevated bg-elevated-bg px-3 py-2 text-sm text-elevated">
          Last updated {Math.floor(ageMs / 1000)}s ago
        </div>
      )}
      {/* Real content renders regardless — stale data is shown, greyed
          if disconnected, per §10's explicit "keep showing last-known
          data, not blank" rule */}
      <div className={ageMs > 5 * 60_000 ? "opacity-50" : ""}>{children}</div>
    </div>
  );
}
```

---

## Verification Steps

**Step 1:** `npm run build` — succeeds.

**Step 2 (real, not simulated):** Wrap a test component in `<ResilienceWrapper lastUpdateMs={Date.now() - 70_000} loading={false}>`, confirm the "last updated" banner renders. Change to `Date.now() - 400_000`, confirm the "connection lost" state and 50% opacity both apply.

**Step 3:** With `useLiveTelemetry()` mounted and a real Supabase connection, physically disconnect your network — confirm `connected` flips to `false` within Supabase's normal reconnection-detection window, and confirm the resilience wrapper genuinely reflects that (not just that the hook's internal state changed, but that it actually renders differently).

**Step 4:** Confirm `usePolledQuery` and `useStaticQuery` are genuinely different at the network level — open browser dev tools' network tab, confirm the polled hook fires a new request every ~20s while the static hook fires exactly once per page load, not repeating.

## Known open items
None — self-contained, builds only on Sessions 10-12.
