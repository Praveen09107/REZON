"use client";
import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { NoDeviceYetState, QueryFailedState, ProjectPausedLikelyState } from "@/components/status/status-states";

type PageState = "loading" | "ok" | "no-device-yet" | "query-failed" | "paused-likely";

interface LatestSummary { avg_fused_score: number; period_start: string; }

export default function PublicStatusPage() {
  const [state, setState] = useState<PageState>("loading");
  const [summary, setSummary] = useState<LatestSummary | null>(null);

  const load = useCallback(async () => {
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
  }, []);

  useEffect(() => { load(); }, [load]);

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
