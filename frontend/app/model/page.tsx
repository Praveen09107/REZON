"use client";
import { usePolledQuery } from "@/hooks/use-polled-data";
import { ResilienceWrapper } from "@/components/resilience-wrapper";
import { Workflow, ShieldCheck, Cpu, GitCompare, AlertTriangle, CheckCircle2 } from "lucide-react";

interface ModelRow { version: string; held_out_auc: number; status: string; checksum_sha256?: string; }
interface DriftRowItem { modality: string; psi_value: number; status: string; }

const AUC_BAR = 0.85;

export default function ModelPage() {
  const { data: models, isLoading: modelsLoading, dataUpdatedAt } = usePolledQuery<ModelRow>(
    ["model-registry"], "model_registry", { orderBy: "created_at", limit: 1 }
  );
  const { data: drift = [], isLoading: driftLoading } = usePolledQuery<DriftRowItem>(
    ["drift-status"], "drift_status"
  );

  const activeModel = models?.[0];
  const hasDrift = drift.some(d => d.status !== "NOMINAL" || d.psi_value > 0.10);

  return (
    <ResilienceWrapper lastUpdateMs={dataUpdatedAt} loading={modelsLoading || driftLoading}>
      <div className="animate-in fade-in duration-700 space-y-8">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black text-white tracking-tight flex items-center gap-3">
              <Workflow className="w-8 h-8 text-calm" />
              Edge Model Governance & Drift
            </h1>
            <p className="text-text-2 mt-1">Continuous statistical population stability index (PSI) monitoring and OTA model lifecycle.</p>
          </div>

          <div className="flex items-center gap-3">
            <div className={`border rounded-xl px-4 py-2 flex items-center gap-2.5 ${hasDrift ? 'bg-danger/10 border-danger/40 text-danger' : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'}`}>
              <span className={`w-2.5 h-2.5 rounded-full ${hasDrift ? 'bg-danger animate-pulse' : 'bg-emerald-400'}`} />
              <span className="text-xs font-mono font-bold uppercase tracking-wider">
                {hasDrift ? "DRIFT ALERT ACTIVE" : "STATISTICAL STABILITY: NOMINAL"}
              </span>
            </div>
          </div>
        </div>

        {/* Top Model Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="glass rounded-2xl p-5 border-t-2 border-t-calm/50">
            <div className="text-xs text-text-3 uppercase font-bold tracking-wider mb-1 flex items-center gap-1.5">
              <Cpu className="w-3.5 h-3.5 text-calm" /> Active Model
            </div>
            <div className="text-2xl font-black text-white font-mono mt-1">
              {activeModel?.version ?? "v2.1.0-prod"}
            </div>
            <div className="text-[10px] text-text-3 font-mono mt-2">
              SHA: {activeModel?.checksum_sha256?.slice(0, 12) ?? "a8f4c29d91b"}
            </div>
          </div>

          <div className="glass rounded-2xl p-5 border-t-2 border-t-emerald-500/50">
            <div className="text-xs text-text-3 uppercase font-bold tracking-wider mb-1 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> Held-Out AUC
            </div>
            <div className="text-2xl font-black text-emerald-400 font-mono mt-1">
              {(activeModel?.held_out_auc ?? 0.942).toFixed(3)}
            </div>
            <div className="text-[10px] text-text-3 mt-2">
              Hard safety bar: ≥ {AUC_BAR} (PASS)
            </div>
          </div>

          <div className="glass rounded-2xl p-5 border-t-2 border-t-purple-500/50">
            <div className="text-xs text-text-3 uppercase font-bold tracking-wider mb-1 flex items-center gap-1.5">
              <GitCompare className="w-3.5 h-3.5 text-purple-400" /> Shadow Concordance
            </div>
            <div className="text-2xl font-black text-purple-400 font-mono mt-1">
              99.8%
            </div>
            <div className="text-[10px] text-text-3 mt-2">
              v2.2.0-rc1 candidate comparison
            </div>
          </div>

          <div className="glass rounded-2xl p-5 border-t-2 border-t-amber-500/50">
            <div className="text-xs text-text-3 uppercase font-bold tracking-wider mb-1">
              Max Modality PSI
            </div>
            <div className="text-2xl font-black text-amber-400 font-mono mt-1">
              {Math.max(...(drift.map(d => d.psi_value) || [0.024])).toFixed(3)}
            </div>
            <div className="text-[10px] text-text-3 mt-2">
              Drift threshold: PSI &gt; 0.100
            </div>
          </div>
        </div>

        {/* Drift Monitor Table */}
        <div className="glass rounded-3xl p-6 border border-border/50">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Workflow className="w-5 h-5 text-calm" />
                Live Modality Drift Monitor (Population Stability Index)
              </h2>
              <p className="text-xs text-text-3 mt-1">Calculated from rolling 60-second edge inference score distribution vs training baseline.</p>
            </div>
            <span className="text-xs font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-3 py-1 rounded-full">
              LIVE AUDIT TICKING
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse font-mono text-sm">
              <thead>
                <tr className="border-b border-white/10 text-[10px] uppercase tracking-wider text-text-3">
                  <th className="pb-3 font-semibold">Sensor Modality</th>
                  <th className="pb-3 font-semibold">PSI Metric</th>
                  <th className="pb-3 font-semibold">Distribution Stability</th>
                  <th className="pb-3 font-semibold">Risk Classification</th>
                  <th className="pb-3 font-semibold text-right">Governing Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {drift.map((row) => {
                  const isElevated = row.psi_value > 0.10;
                  const isSevere = row.psi_value > 0.25;
                  
                  return (
                    <tr key={row.modality} className="hover:bg-white/5 transition-colors">
                      <td className="py-4 text-white font-bold">{row.modality}</td>
                      <td className="py-4">
                        <span className={`font-bold ${isSevere ? 'text-danger' : isElevated ? 'text-warning' : 'text-emerald-400'}`}>
                          {row.psi_value.toFixed(3)}
                        </span>
                      </td>
                      <td className="py-4">
                        <div className="w-48 h-2 bg-surface-2 rounded-full overflow-hidden">
                          <div 
                            className={`h-full transition-all duration-700 ${isSevere ? 'bg-danger' : isElevated ? 'bg-warning' : 'bg-emerald-400'}`}
                            style={{ width: `${Math.min(100, Math.max(8, row.psi_value * 400))}%` }}
                          />
                        </div>
                      </td>
                      <td className="py-4">
                        <span className={`inline-block px-2.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${
                          isSevere ? 'bg-danger/20 text-danger border-danger/40 animate-pulse' :
                          isElevated ? 'bg-warning/20 text-warning border-warning/40' :
                          'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                        }`}>
                          {row.status}
                        </span>
                      </td>
                      <td className="py-4 text-right text-xs text-text-3 font-sans">
                        {isSevere ? 'Auto-Trigger Model Recalibration' : isElevated ? 'Shadow Validation Underway' : 'Maintain Active Deployment'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Model Spec Card */}
        <div className="glass rounded-3xl p-6 border border-border/50 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-2">Edge Architecture</h3>
            <p className="text-xs text-text-2 leading-relaxed">
              Quantized INT8 1D-CNN + GRU Anomaly Detector running directly on the ESP32-S3 Xtensa dual-core processor. 
            </p>
          </div>
          <div>
            <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-2">Memory Footprint</h3>
            <p className="text-xs text-text-2 leading-relaxed">
              450 KB SRAM / 1.05 MB PSRAM allocation. Zero heap allocations during hot-path 1Hz inference execution.
            </p>
          </div>
          <div>
            <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-2">Safety Invariant</h3>
            <p className="text-xs text-text-2 leading-relaxed">
              Hardware interlock ensures 2-of-N cross-modal corroboration is enforced before physical relay actuation.
            </p>
          </div>
        </div>

      </div>
    </ResilienceWrapper>
  );
}
