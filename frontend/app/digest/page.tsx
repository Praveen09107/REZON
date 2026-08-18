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
