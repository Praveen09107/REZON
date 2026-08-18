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
