interface PipelineStageProps {
  number: number;
  label: string;
  sublabel: string;
  status: "passed" | "active" | "idle" | "blocked";
}

const STATUS_STYLES: Record<PipelineStageProps["status"], string> = {
  passed: "border-calm text-calm bg-calm-bg",
  active: "border-elevated text-elevated bg-elevated-bg shadow-[0_0_0_6px_rgba(224,160,48,0.12)]",
  blocked: "border-danger text-danger bg-danger-bg",
  idle: "border-border text-text-3 bg-surface-2",
};

export function PipelineStage({ number, label, sublabel, status }: PipelineStageProps) {
  return (
    <div className="flex-1 text-center">
      <div className={`mx-auto mb-2 flex h-14 w-14 items-center justify-center rounded-full border-2 ${STATUS_STYLES[status]}`}>
        {number}
      </div>
      <div className="text-xs font-medium text-text">{label}</div>
      <div className="mx-auto mt-0.5 max-w-[110px] text-[10.5px] text-text-3">{sublabel}</div>
    </div>
  );
}
