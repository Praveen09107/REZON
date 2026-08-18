interface DriftRowProps { modality: string; psiValue: number; status: string; }

const STATUS_COLOR: Record<string, string> = {
  stable: "text-calm", watch: "text-elevated", significant: "text-danger",
};

export function DriftRow({ modality, psiValue, status }: DriftRowProps) {
  return (
    <div className="flex items-center justify-between border-b border-border py-2.5 last:border-0">
      <span className="text-sm capitalize text-text-2">{modality}</span>
      <div className="flex items-center gap-3">
        <span className="text-xs text-text-3">PSI {psiValue.toFixed(3)}</span>
        <span className={`text-sm font-medium ${STATUS_COLOR[status] ?? "text-text-2"}`}>{status}</span>
      </div>
    </div>
  );
}
