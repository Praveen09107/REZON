interface DailySummary { period_start: string; avg_fused_score: number; event_count: number; }

// Same honest-templating philosophy as Session 16's generateNarrative —
// real numbers, real composition, no fabricated insight beyond what
// the data actually shows.
export function generateWeeklyDigest(dailyRows: DailySummary[]): string {
  if (dailyRows.length === 0) return "No data available for this period yet.";

  const totalEvents = dailyRows.reduce((sum, r) => sum + r.event_count, 0);
  const avgScore = dailyRows.reduce((sum, r) => sum + r.avg_fused_score, 0) / dailyRows.length;
  const busiestDay = [...dailyRows].sort((a, b) => b.event_count - a.event_count)[0];
  const busiestDayName = new Date(busiestDay.period_start).toLocaleDateString(undefined, { weekday: "long" });

  return `This week, the space recorded ${totalEvents} event${totalEvents === 1 ? "" : "s"} ` +
    `across ${dailyRows.length} day${dailyRows.length === 1 ? "" : "s"} of data. ` +
    `The average fused anomaly score was ${avgScore.toFixed(2)}. ` +
    `${busiestDayName} had the most activity, with ${busiestDay.event_count} recorded event${busiestDay.event_count === 1 ? "" : "s"}.`;
}
