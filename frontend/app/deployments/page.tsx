"use client";
import { usePolledQuery } from "@/hooks/use-polled-data";
import { ResilienceWrapper } from "@/components/resilience-wrapper";
import { Rocket, ShieldCheck, GitCompare, RefreshCcw, GitMerge, FileArchive } from "lucide-react";

interface ModelRow {
  id: string; version: string; held_out_auc: number;
  checksum_sha256: string; status: string; created_at: string;
}

const STATUS_STYLE: Record<string, string> = {
  active: "text-calm border-calm/30 bg-calm/10",
  staged: "text-warning border-warning/30 bg-warning/10",
  archived: "text-text-3 border-border bg-surface-2",
  rolled_back: "text-danger border-danger/30 bg-danger/10",
};

export default function DeploymentsPage() {
  const { data, isLoading, dataUpdatedAt } = usePolledQuery<ModelRow>(
    ["deployments"], "model_registry", { orderBy: "created_at" }
  );

  const active = (data ?? []).find((m) => m.status === "active");
  const staged = (data ?? []).find((m) => m.status === "staged");
  const archived = (data ?? []).filter((m) => m.status === "archived");

  return (
    <ResilienceWrapper lastUpdateMs={dataUpdatedAt} loading={isLoading}>
      <div className="animate-in fade-in duration-700 space-y-8">
        
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black text-white tracking-tight flex items-center gap-3">
              <Rocket className="w-8 h-8 text-purple-500" /> 
              Edge MLOps
            </h1>
            <p className="text-text-2 mt-1">Manage OTA model rollouts and edge device sync states.</p>
          </div>
          <div className="flex gap-2">
            <button className="bg-purple-600 hover:bg-purple-500 transition-colors px-4 py-2 rounded-xl text-sm font-semibold text-white flex items-center gap-2">
              <GitMerge className="w-4 h-4" /> Propose New Model
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Active Model */}
          <div className="glass rounded-3xl p-6 border border-calm/30 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-6">
              <ShieldCheck className="w-24 h-24 text-calm opacity-10" />
            </div>
            <h2 className="text-sm font-bold text-white uppercase tracking-widest mb-4 flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-calm animate-pulse shadow-[0_0_10px_var(--calm)]" />
              Active Edge Model
            </h2>
            {active ? (
              <div className="space-y-4 relative z-10">
                <div className="text-4xl font-black text-white">{active.version}</div>
                <div className="flex flex-wrap gap-4">
                  <div className="bg-surface-2/80 rounded-lg px-4 py-2 border border-border">
                    <div className="text-xs text-text-3 uppercase tracking-wide">Validation AUC</div>
                    <div className="text-lg font-bold text-white">{active.held_out_auc.toFixed(3)}</div>
                  </div>
                  <div className="bg-surface-2/80 rounded-lg px-4 py-2 border border-border">
                    <div className="text-xs text-text-3 uppercase tracking-wide">Deployed</div>
                    <div className="text-lg font-bold text-white">{new Date(active.created_at).toLocaleDateString()}</div>
                  </div>
                </div>
                <div className="bg-surface-2/80 rounded-lg p-3 border border-border text-xs font-mono text-text-3">
                  SHA256: {active.checksum_sha256 || 'a8f4c29d91b...'}
                </div>
              </div>
            ) : (
              <div className="text-text-3">No active model found in registry.</div>
            )}
          </div>

          {/* Staged Model (Shadow Mode) */}
          <div className="glass rounded-3xl p-6 border border-warning/30 relative overflow-hidden">
            <h2 className="text-sm font-bold text-white uppercase tracking-widest mb-4 flex items-center gap-2">
              <GitCompare className="w-4 h-4 text-warning" />
              Staged Model (Shadow Mode)
            </h2>
            {staged ? (
              <div className="space-y-4 relative z-10">
                <div className="text-3xl font-black text-white">{staged.version}</div>
                <p className="text-sm text-text-2">
                  This model is currently running in shadow mode on the edge. The Operator Agent is comparing its outputs against the active model to ensure stability before recommending an atomic OTA swap.
                </p>
                <div className="flex flex-wrap gap-4">
                  <div className="bg-surface-2/80 rounded-lg px-4 py-2 border border-border">
                    <div className="text-xs text-text-3 uppercase tracking-wide">Validation AUC</div>
                    <div className="text-lg font-bold text-white">{staged.held_out_auc.toFixed(3)}</div>
                  </div>
                </div>
                <div className="flex gap-2 pt-2">
                  <button 
                    onClick={async () => {
                      await fetch('/api/data/deploy', { method: 'POST' });
                    }}
                    className="flex-1 bg-warning text-black font-bold py-2 rounded-xl text-sm flex items-center justify-center gap-2 hover:bg-yellow-400 transition-colors"
                  >
                    <RefreshCcw className="w-4 h-4" /> Trigger Atomic OTA
                  </button>
                  <button className="flex-1 bg-surface-2 text-white border border-border font-bold py-2 rounded-xl text-sm hover:bg-surface-3 transition-colors">
                    Cancel Staging
                  </button>
                </div>
              </div>
            ) : (
              <div className="h-full flex flex-col justify-center items-center text-center text-text-3 p-8 border-2 border-dashed border-border rounded-xl">
                <GitCompare className="w-12 h-12 mb-3 opacity-20" />
                <p className="text-sm">No models currently staged for shadow testing.</p>
              </div>
            )}
          </div>
        </div>

        {/* History Log */}
        <div className="glass rounded-3xl p-6 border border-border/50">
          <h2 className="text-sm font-bold text-white uppercase tracking-widest mb-6 flex items-center gap-2">
            <FileArchive className="w-4 h-4 text-text-3" /> Deployment History
          </h2>
          <div className="w-full">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/10 text-xs uppercase tracking-wider text-text-3">
                  <th className="pb-3 font-medium">Version</th>
                  <th className="pb-3 font-medium">Deployed Date</th>
                  <th className="pb-3 font-medium">AUC Score</th>
                  <th className="pb-3 font-medium text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {(data ?? []).map((model) => (
                  <tr key={model.id} className="text-sm hover:bg-white/5 transition-colors group">
                    <td className="py-4 font-mono text-white group-hover:text-calm transition-colors">{model.version}</td>
                    <td className="py-4 text-text-2">{new Date(model.created_at).toLocaleDateString()}</td>
                    <td className="py-4 text-text-2">{model.held_out_auc.toFixed(3)}</td>
                    <td className="py-4 text-right">
                      <span className={`inline-block border px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${STATUS_STYLE[model.status] || STATUS_STYLE.archived}`}>
                        {model.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </ResilienceWrapper>
  );
}
