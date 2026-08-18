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
