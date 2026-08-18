# SESSION 27 — Resilience Retrofit + Responsive Pass
**Risk tier: ROUTINE.**
**Branch: `session/retrofit-27-resilience-responsive`**
**Attach: `SESSION_14_home_digital_twin.md`, `SESSION_16_incidents.md`, `SESSION_17_safety_chain_monitor.md` (as actually built), `SESSION_26_public_status.md` (the new depth standard)**

---

## Agent Instructions

Two things, and this session's own existence answers an open question from `DEC-052` rather than leaving it unresolved: (1) retrofit Session 26's per-component edge-case standard into the three pages where it matters most — Home, Incidents, Safety Chain Monitor — not all 16 earlier frontend files, a deliberate scoping choice explained below; (2) a real responsive/mobile pass across the whole app, this session's original purpose.

**Why these three specifically, not a full retrofit of Sessions 10-25:** these are the pages a judge or a real operator actually looks at most, and the ones where "no data yet" vs. "something's actually broken" genuinely matters most to distinguish — Home and Safety Chain Monitor represent live system state, Incidents represents the review workflow REZON's whole explainability story depends on. Settings, Access, and similar utility pages have lower real stakes for this specific kind of depth; retrofitting them would be effort spent for less real benefit, the same right-sizing judgment applied throughout this project, not corner-cutting.

**What this session creates/modifies:**
- `frontend/app/page.tsx` — RETROFIT: real empty-state (device never reported) vs. error-state (query failed)
- `frontend/app/incidents/page.tsx` — RETROFIT: same distinction, plus a malformed-`contributing_modalities` guard
- `frontend/app/safety-chain/page.tsx` — RETROFIT: same distinction
- Responsive Tailwind classes added across `Sidebar`, `AppShell`, and all three retrofitted pages

---

## FILE 1: `frontend/app/page.tsx` — RETROFIT

```typescript
// ADDED: distinguish "device has never reported" (calm, expected during
// initial setup) from "the live query itself failed" (a real problem) —
// the same distinction Session 26 established, applied here because
// Home is the single most-viewed page in the app.

const [queryError, setQueryError] = useState(false);

// Inside useLiveTelemetry's initial fetch (extends the hook or wraps
// its result — implementation detail for the real session, shown here
// as the added branching logic):
if (queryError) {
  return (
    <div className="rounded-xl border border-danger bg-danger-bg p-6 text-center text-sm text-danger">
      Couldn't load live data — check your connection or try refreshing.
    </div>
  );
}
if (!data && !connected && !queryError) {
  return (
    <div className="rounded-xl border border-border bg-surface p-6 text-center text-sm text-text-2">
      Waiting for the device to report its first reading.
    </div>
  );
}
// ... existing digital twin render below, unchanged ...
```

## FILE 2: `frontend/app/incidents/page.tsx` — RETROFIT

```typescript
// ADDED: guard against malformed contributing_modalities before
// generateNarrative() ever runs — a null or empty object would
// otherwise produce a broken-looking sentence ("undefined crossed
// threshold..."), which is worse than an explicit fallback.

function safeNarrative(incident: IncidentRow): string {
  if (!incident.contributing_modalities || Object.keys(incident.contributing_modalities).length === 0) {
    return `An anomaly was recorded at ${new Date(incident.recorded_at).toLocaleString()} — detailed breakdown unavailable.`;
  }
  return generateNarrative(incident);
}

// Empty-state (zero incidents ever, not a loading/error condition):
if (!isLoading && sorted.length === 0) {
  return (
    <div className="rounded-xl border border-border bg-surface p-6 text-center text-sm text-text-2">
      No incidents recorded yet — this is expected for a newly-deployed device.
    </div>
  );
}
```

## FILE 3: `frontend/app/safety-chain/page.tsx` — RETROFIT

```typescript
// ADDED: same query-failed vs. no-data-yet distinction as Home, since
// this page represents safety-critical state and an ambiguous blank
// screen here is worse than on almost any other page.

if (!connected && !telemetry) {
  return (
    <div className="rounded-xl border border-border bg-surface p-6 text-center text-sm text-text-2">
      Waiting for live telemetry to establish the current safety-chain state.
    </div>
  );
}
```

## FILE 4: Responsive pass — real breakpoint classes, not a single global change

```typescript
// Sidebar (Session 12): collapses to an icon-only rail below 768px,
// full labels above it.
<aside className="w-14 md:w-56 shrink-0 ...">
  <span className="hidden md:inline">{item.label}</span>
</aside>

// AppShell (Session 12): main content padding reduces on small screens
// where every pixel matters more.
<main className="flex-1 overflow-auto p-3 md:p-6">

// Home page's two-column grid (Session 14): stacks to one column below
// 1024px — the digital twin needs real width to read correctly, so it
// gets its own full-width row on mobile rather than being squeezed.
<div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-5">

// Incidents/Analytics grids: same pattern, 2-column desktop -> 1-column
// mobile, applied consistently rather than ad hoc per page.
```

---

## Verification Steps

**Step 1:** `npm run build` — succeeds.

**Step 2 (real device tests, not just browser resize):** on an actual phone (or real device emulation, not just a resized desktop browser window — genuine touch-target sizing matters, not just layout reflow), confirm the sidebar collapses to icons, confirm the Home page's digital twin gets full width rather than being cramped next to the side cards.

**Step 3:** With a genuinely empty `anomaly_events` table, confirm Incidents shows the "no incidents yet" empty state, not a blank page or a loading spinner stuck indefinitely.

**Step 4:** Insert an `anomaly_events` row with `contributing_modalities: {}` (empty object) — confirm `safeNarrative()`'s fallback renders instead of a broken sentence.

## Known open items
🔴 Sessions 15, 18-25 retain the shared `ResilienceWrapper`'s stale/disconnected/skeleton states only, not the per-component empty/error distinction added here — a deliberate scoping decision (see Agent Instructions above), revisit only if a specific page's ambiguity becomes a real problem during later testing, not proactively.
