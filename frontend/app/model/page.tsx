"use client";
import { usePolledQuery } from "@/hooks/use-polled-data";
import { ResilienceWrapper } from "@/components/resilience-wrapper";
import { DriftRow } from "@/components/model/drift-row";

interface ModelRow { version: string; held_out_auc: number; status: string; }
interface DriftRow2 { modality: string; psi_value: number; status: string; }

const AUC_BAR = 0.85;  // AI/ML Spec §9 — the hard bar, restated here
                          // for display context, not re-derived

export default function ModelPage() {
  const { data: models, isLoading: modelsLoading, dataUpdatedAt } = usePolledQuery<ModelRow>(
    ["model-registry"], "model_registry", { orderBy: "created_at", limit: 1 }
  );
  const { data: drift, isLoading: driftLoading } = usePolledQuery<DriftRow2>(
    ["drift-status"], "drift_status"  // DEC-041's new table
  );

  const activeModel = models?.[0];

  return (
    <ResilienceWrapper lastUpdateMs={dataUpdatedAt} loading={modelsLoading || driftLoading}>
      <div className="mb-5 grid grid-cols-3 gap-4">
        <div className="rounded-xl border border-border bg-surface p-4">
          <div className="text-xs text-text-2">Active model</div>
          <div className="text-lg font-semibold text-text">{activeModel?.version ?? "—"}</div>
        </div>
        <div className="rounded-xl border border-border bg-surface p-4">
          <div className="text-xs text-text-2">Held-out AUC</div>
          <div className={`text-lg font-semibold ${(activeModel?.held_out_auc ?? 0) >= AUC_BAR ? "text-calm" : "text-danger"}`}>
            {activeModel?.held_out_auc?.toFixed(3) ?? "—"}
          </div>
        </div>
      </div>
      <div className="rounded-xl border border-border bg-surface p-4">
        <div className="mb-2 text-xs text-text-2">Drift monitor — per modality (weekly, Local MLOps Spec §3)</div>
        {(drift ?? []).map((d) => (
          <DriftRow key={d.modality} modality={d.modality} psiValue={d.psi_value} status={d.status} />
        ))}
      </div>
    </ResilienceWrapper>
  );
}
