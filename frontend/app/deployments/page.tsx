"use client";
import { usePolledQuery } from "@/hooks/use-polled-data";
import { ResilienceWrapper } from "@/components/resilience-wrapper";

interface ModelRow {
  id: string; version: string; held_out_auc: number;
  checksum_sha256: string; status: string; created_at: string;
}

const STATUS_STYLE: Record<string, string> = {
  active: "text-calm bg-calm-bg",
  staged: "text-elevated bg-elevated-bg",
  archived: "text-text-3 bg-surface-2",
  rolled_back: "text-danger bg-danger-bg",
};

export default function DeploymentsPage() {
  const { data, isLoading, dataUpdatedAt } = usePolledQuery<ModelRow>(
    ["deployments"], "model_registry", { orderBy: "created_at" }
  );

  const staged = (data ?? []).find((m) => m.status === "staged");

  return (
    <ResilienceWrapper lastUpdateMs={dataUpdatedAt} loading={isLoading}>
      {staged && (
        <div className="mb-5 rounded-xl border border-elevated bg-elevated-bg p-5">
          <div className="mb-2 text-sm font-medium text-elevated">
            Model {staged.version} is staged and validated
          </div>
          <div className="grid grid-cols-3 gap-3 text-xs text-text-2">
            <div>Held-out AUC: <span className="text-text">{staged.held_out_auc.toFixed(3)}</span></div>
            <div>Checksum: <span className="text-text font-mono">{staged.checksum_sha256.slice(0, 12)}…</span></div>
            <div>Staged: <span className="text-text">{new Date(staged.created_at).toLocaleDateString()}</span></div>
          </div>
          <p className="mt-3 text-xs text-text-3">
            The device adopts this automatically on its next OTA check cycle
            (Firmware Spec §6) — checksum-verified, dry-run tested, atomically
            swapped. This page reflects that process; it does not trigger it.
          </p>
        </div>
      )}

      <div className="rounded-xl border border-border bg-surface p-4">
        <div className="mb-2 text-xs text-text-2">Deployment history</div>
        {(data ?? []).map((model) => (
          <div key={model.id} className="flex items-center justify-between border-b border-border py-2.5 last:border-0">
            <span className="text-sm text-text">{model.version}</span>
            <div className="flex items-center gap-3">
              <span className="text-xs text-text-3">AUC {model.held_out_auc.toFixed(3)}</span>
              <span className={`rounded px-2 py-0.5 text-xs ${STATUS_STYLE[model.status] ?? "text-text-2 bg-surface-2"}`}>
                {model.status}
              </span>
            </div>
          </div>
        ))}
      </div>
    </ResilienceWrapper>
  );
}
