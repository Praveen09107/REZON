"use client";
import { usePolledQuery } from "@/hooks/use-polled-data";
import { ResilienceWrapper } from "@/components/resilience-wrapper";
import { TimelineItem } from "@/components/timeline/timeline-item";

interface TimelineEvent {
  recorded_at: string;
  event_type: string;
  fused_score: number;
}

export default function TimelinePage() {
  const { data, isLoading, dataUpdatedAt } = usePolledQuery<TimelineEvent>(
    ["timeline"], "anomaly_events", { orderBy: "recorded_at", limit: 50 }
  );

  return (
    <ResilienceWrapper lastUpdateMs={dataUpdatedAt} loading={isLoading}>
      <div className="rounded-xl border border-border bg-surface p-4">
        {(data ?? []).map((event, i) => (
          <TimelineItem key={i} timestamp={event.recorded_at}
            type={event.event_type as any}
            summary={`${event.event_type.replace(/_/g, " ")} — fused score ${event.fused_score.toFixed(2)}`} />
        ))}
      </div>
    </ResilienceWrapper>
  );
}
