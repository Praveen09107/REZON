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
