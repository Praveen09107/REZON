"use client";
import { useStaticQuery } from "@/hooks/use-static-data";
import { ResilienceWrapper } from "@/components/resilience-wrapper";

interface ModelVersion { version: string; held_out_auc: number; status: string; created_at: string; }

export default function SinceCalibrationPage() {
  const { data, isLoading, dataUpdatedAt } = useStaticQuery<ModelVersion>(
    ["model-history"], "model_registry"
  );

  const sorted = [...(data ?? [])].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );
  // Honest comparison: the FIRST model registered (Stage 1+2, pre-burn-in)
  // vs the CURRENT active one — not a fabricated "improvement %,"
  // just the two real AUC numbers, side by side, per AI/ML Spec §9's
  // held-out evaluation being the only trustworthy accuracy claim
  // this project makes.
  const preCalibration = sorted[0];
  const current = sorted.find((m) => m.status === "active") ?? sorted[sorted.length - 1];

  return (
    <ResilienceWrapper lastUpdateMs={dataUpdatedAt} loading={isLoading}>
      {!preCalibration || !current ? (
        <div className="text-text-2">Not enough model history yet — this page becomes meaningful after Session 34's calibration pass.</div>
      ) : (
        <div className="grid grid-cols-2 gap-5">
          <div className="rounded-xl border border-border bg-surface p-5">
            <div className="text-xs text-text-2">Pre-calibration ({preCalibration.version})</div>
            <div className="text-2xl font-semibold text-text-2">{preCalibration.held_out_auc.toFixed(3)}</div>
            <div className="text-xs text-text-3">held-out AUC, public data only</div>
          </div>
          <div className="rounded-xl border border-calm bg-surface p-5">
            <div className="text-xs text-text-2">Current ({current.version})</div>
            <div className="text-2xl font-semibold text-calm">{current.held_out_auc.toFixed(3)}</div>
            <div className="text-xs text-text-3">held-out AUC, calibrated to this space</div>
          </div>
        </div>
      )}
    </ResilienceWrapper>
  );
}
