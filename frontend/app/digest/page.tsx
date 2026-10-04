"use client";
import { useState } from "react";
import { FileText, Copy, Check, ShieldCheck, Cpu, Clock, Activity, AlertCircle } from "lucide-react";

export default function DigestPage() {
  const [copied, setCopied] = useState(false);

  const digestContent = `REZON AUTONOMOUS SHIFT HANDOVER BRIEF
Timestamp: ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
Asset: REZON-01 (Induction Motor Alpha-4)
Agent Consensus: 5/5 ONLINE (100% Concordance)

EXECUTIVE OPERATIONAL SUMMARY:
• Total Operational Ingest: 28,800 frames at 1Hz continuous cadence.
• Physical Safety Chain Status: 0 unhandled safety actuations. Hardware interlock armed and verified.
• Projected Asset RUL: MTBF estimated at 2,420 operating hours (±35h confidence interval).
• Model Health: Active model v2.1.0-prod operating at 0.992 space-calibrated AUC.
• Zero statistical drift detected across all 5 sensing modalities (Max PSI: 0.024).

DIAGNOSTICIAN AGENT NOTE:
Acoustic noise floor remains suppressed at 40 dB RMS with zero bearing frequency harmonics detected in last 12-hour evaluation window. Sensor fusion pipeline latency averaged 1.18ms.`;

  const handleCopy = () => {
    navigator.clipboard.writeText(digestContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="animate-in fade-in duration-700 space-y-8">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-white tracking-tight flex items-center gap-3">
            <FileText className="w-8 h-8 text-calm" /> 
            Autonomous Shift Digest
          </h1>
          <p className="text-text-2 mt-1">Multi-agent intelligence summary and edge operational handover report.</p>
        </div>

        <button 
          onClick={handleCopy}
          className="bg-calm hover:bg-calm/80 text-black font-bold px-4 py-2 rounded-xl text-sm transition-all flex items-center gap-2"
        >
          {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
          {copied ? "Copied to Clipboard!" : "Copy Executive Brief"}
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="glass rounded-2xl p-5 border-t-2 border-t-calm/50">
          <div className="text-xs text-text-3 uppercase font-bold tracking-wider mb-1 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-calm" /> Shift Duration
          </div>
          <div className="text-2xl font-black text-white font-mono mt-1">
            12.0 Hours
          </div>
          <div className="text-xs text-text-3 mt-1">Continuous 1Hz telemetry</div>
        </div>

        <div className="glass rounded-2xl p-5 border-t-2 border-t-emerald-500/50">
          <div className="text-xs text-text-3 uppercase font-bold tracking-wider mb-1 flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> Edge MTBF
          </div>
          <div className="text-2xl font-black text-emerald-400 font-mono mt-1">
            2,420 Hours
          </div>
          <div className="text-xs text-text-3 mt-1">Predictive wear cone nominal</div>
        </div>

        <div className="glass rounded-2xl p-5 border-t-2 border-t-purple-500/50">
          <div className="text-xs text-text-3 uppercase font-bold tracking-wider mb-1 flex items-center gap-1.5">
            <Cpu className="w-3.5 h-3.5 text-purple-400" /> Multi-Agent Status
          </div>
          <div className="text-2xl font-black text-purple-400 font-mono mt-1">
            5 / 5 Active
          </div>
          <div className="text-xs text-text-3 mt-1">Autonomous consensus: 100%</div>
        </div>

        <div className="glass rounded-2xl p-5 border-t-2 border-t-amber-500/50">
          <div className="text-xs text-text-3 uppercase font-bold tracking-wider mb-1 flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5 text-amber-400" /> Ingress Health
          </div>
          <div className="text-2xl font-black text-amber-400 font-mono mt-1">
            0 Drops
          </div>
          <div className="text-xs text-text-3 mt-1">99.98% packet delivery</div>
        </div>
      </div>

      {/* Main Executive Brief Card */}
      <div className="glass rounded-3xl p-8 border border-border/50 max-w-4xl space-y-6">
        <div className="flex justify-between items-center border-b border-border/40 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 rounded-full bg-emerald-400 animate-pulse" />
            <h2 className="text-lg font-bold text-white uppercase tracking-wider">
              Shift Intelligence Handoff
            </h2>
          </div>
          <span className="text-xs font-mono text-text-3">
            Generated autonomously by Diagnostician & Operator Agents
          </span>
        </div>

        <div className="space-y-4 font-mono text-sm leading-relaxed text-text-2 bg-surface-2/60 p-6 rounded-2xl border border-border/40">
          <p className="text-white font-bold">
            Asset: REZON-01 · Industrial Drive Unit · Alpha Sector
          </p>
          <p>
            The physical environment and edge compute node have performed nominally throughout the shift. All five physical transducers (INMP441, MPU-6050, DHT22, MQ135, ACS712) maintain calibrated zero-points with zero harmonic skew.
          </p>
          <div className="my-3 border-l-2 border-calm pl-4 py-1 text-xs text-calm font-sans italic">
            "Diagnostician Agent evaluated 43,200 rolling spectral windows. Cross-modal correlation is 1.00. No maintenance intervention required before scheduled 2,000h inspection."
          </div>
          <p className="text-xs text-text-3">
            Signed by Multi-Agent Consensus: [Watcher: OK] · [Diagnostician: OK] · [Forecaster: OK] · [Operator: OK]
          </p>
        </div>
      </div>

    </div>
  );
}
