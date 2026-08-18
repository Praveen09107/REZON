interface TimelineItemProps {
  timestamp: string;
  type: "alert" | "actuation" | "suppressed_debounce" | "suppressed_cooldown" | "model_update" | "calibration_milestone";
  summary: string;
}

const TYPE_STYLES: Record<string, { color: string; icon: string }> = {
  alert: { color: "text-elevated", icon: "⚠" },
  actuation: { color: "text-danger", icon: "⏻" },
  suppressed_debounce: { color: "text-text-3", icon: "○" },
  suppressed_cooldown: { color: "text-text-3", icon: "○" },
  model_update: { color: "text-calm", icon: "◈" },
  calibration_milestone: { color: "text-calm", icon: "✓" },
};

// Unified feed — deliberately includes suppressed events, not just
// fired ones, per the actuation state machine's own logging discipline
// (Firmware Spec §5): a suppressed candidate is real, useful history,
// not noise to filter out.
export function TimelineItem({ timestamp, type, summary }: TimelineItemProps) {
  const style = TYPE_STYLES[type] ?? { color: "text-text-2", icon: "•" };
  return (
    <div className="flex items-start gap-3 border-b border-border py-3 last:border-0">
      <span className={style.color}>{style.icon}</span>
      <div>
        <div className="text-sm text-text">{summary}</div>
        <div className="text-xs text-text-3">{new Date(timestamp).toLocaleString()}</div>
      </div>
    </div>
  );
}
