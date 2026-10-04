"use client";
import Link from "next/link";
import { usePolledQuery } from "@/hooks/use-polled-data";
import { ResilienceWrapper } from "@/components/resilience-wrapper";
import { AlertOctagon, BrainCircuit, History, CheckCircle2, ArrowRight } from "lucide-react";

interface IncidentRow {
  id: string; recorded_at: string; event_type: string;
  fused_score: number; contributing_modalities: Record<string, number>;
  human_label: string | null; seq_number?: number;
}

const RESPONSE_THRESHOLD = 0.85;

export default function IncidentsPage() {
  const { data, isLoading, dataUpdatedAt } = usePolledQuery<IncidentRow>(
    ["incidents"], "incidents", { limit: 100 }
  );

  const sorted = [...(data ?? [])].sort(
    (a, b) => Math.abs(a.fused_score - RESPONSE_THRESHOLD) - Math.abs(b.fused_score - RESPONSE_THRESHOLD)
  );

  return (
    <ResilienceWrapper lastUpdateMs={dataUpdatedAt} loading={isLoading}>
      <div className="animate-in fade-in duration-700 space-y-6">
        
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black text-white tracking-tight flex items-center gap-3">
              <AlertOctagon className="w-8 h-8 text-warning" /> 
              Triage & RCA
            </h1>
            <p className="text-text-2 mt-1">AI-Diagnosed Root Cause Analysis workflows.</p>
          </div>
          <div className="flex gap-2">
            <button className="bg-surface-2 border border-border hover:bg-surface-3 transition-colors px-4 py-2 rounded-xl text-sm font-semibold text-white flex items-center gap-2">
              <History className="w-4 h-4" /> View Resolved
            </button>
            <button className="bg-calm/10 text-calm border border-calm/30 hover:bg-calm/20 transition-colors px-4 py-2 rounded-xl text-sm font-semibold flex items-center gap-2">
              <BrainCircuit className="w-4 h-4" /> Force Diagnostics
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2 space-y-4">
            <h2 className="text-lg font-bold text-white mb-2">Active Tickets</h2>
            
            {sorted.length === 0 && !isLoading && (
              <div className="glass rounded-3xl p-12 text-center border border-border/50 flex flex-col items-center">
                <CheckCircle2 className="w-12 h-12 text-emerald-500 mb-3 opacity-50" />
                <h3 className="text-xl font-bold text-white mb-1">Inbox Zero</h3>
                <p className="text-text-2">No incidents requiring human review.</p>
              </div>
            )}

            {sorted.map((incident) => (
              <Link 
                key={incident.id || incident.seq_number} 
                href={`/incidents/${incident.id || incident.seq_number}`}
                className="block glass glass-hover rounded-2xl p-5 border border-border/50 group"
              >
                <div className="flex items-start justify-between">
                  <div className="flex gap-4">
                    <div className={`mt-1 w-2 h-2 rounded-full ${incident.fused_score > 0.85 ? 'bg-danger animate-pulse shadow-[0_0_10px_rgba(239,68,68,0.8)]' : 'bg-warning'}`} />
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-mono text-xs text-text-3">TKT-{incident.seq_number ?? '0000'}</span>
                        <span className="text-xs font-bold uppercase tracking-wider text-white">
                          {incident.fused_score > 0.85 ? 'CRITICAL ACTUATION' : 'WARNING DRIFT'}
                        </span>
                        {incident.human_label === "confirmed" ? (
                          <span className="rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 px-2 py-0.5 text-[10px] uppercase font-bold flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" /> Confirmed
                          </span>
                        ) : incident.human_label === "false_alarm" ? (
                          <span className="rounded bg-cyan-500/20 text-cyan-400 border border-cyan-500/40 px-2 py-0.5 text-[10px] uppercase font-bold">
                            False Alarm
                          </span>
                        ) : (
                          <span className="rounded bg-amber-500/15 text-amber-400 border border-amber-500/30 px-2 py-0.5 text-[10px] uppercase font-bold animate-pulse">
                            Requires Review
                          </span>
                        )}
                      </div>
                      <h3 className="text-lg font-semibold text-white mb-1">
                        {(incident as any).rca_diagnosis?.title ?? `${(incident.event_type || 'ANOMALY DETECTED').replace(/_/g, ' ').toUpperCase()} on REZON-01`}
                      </h3>
                      <p className="text-sm text-text-2">
                        {(incident as any).rca_diagnosis?.failure_mode ?? "The Diagnostician agent has generated an automated Root Cause Analysis. Click to investigate sensor freeze-frames and sign off."}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2 shrink-0">
                    <div className="text-xs text-text-3 font-mono">
                      {new Date(incident.recorded_at).toLocaleTimeString()}
                    </div>
                    <div className="w-8 h-8 rounded-full bg-surface-2 flex items-center justify-center group-hover:bg-calm group-hover:text-black transition-colors">
                      <ArrowRight className="w-4 h-4" />
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>

          <div className="space-y-6">
            <div className="glass rounded-3xl p-6 border border-border/50">
              <h3 className="text-sm font-bold text-white mb-4 uppercase tracking-widest flex items-center gap-2">
                <BrainCircuit className="w-4 h-4 text-calm" /> Diagnostician Agent
              </h3>
              <p className="text-sm text-text-2 mb-4 leading-relaxed">
                The Diagnostician correlates multi-modal edge spikes (Audio, Vibration, Gas) against historical failure patterns to generate automated Root Cause Analyses.
              </p>
              <div className="space-y-3">
                <div className="bg-surface-2 rounded-lg p-3 text-xs border border-border">
                  <div className="flex justify-between mb-1">
                    <span className="text-text-3">Accuracy (7d)</span>
                    <span className="text-white font-bold">94.2%</span>
                  </div>
                  <div className="w-full bg-surface h-1 rounded-full overflow-hidden">
                    <div className="bg-calm h-full w-[94%]" />
                  </div>
                </div>
                <div className="bg-surface-2 rounded-lg p-3 text-xs border border-border">
                  <div className="flex justify-between mb-1">
                    <span className="text-text-3">Avg Triage Time</span>
                    <span className="text-white font-bold">1.2s</span>
                  </div>
                  <div className="w-full bg-surface h-1 rounded-full overflow-hidden">
                    <div className="bg-emerald-500 h-full w-[100%]" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>
    </ResilienceWrapper>
  );
}
