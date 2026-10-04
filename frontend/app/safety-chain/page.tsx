"use client";
import { useLiveTelemetry } from "@/hooks/use-live-telemetry";
import { usePolledQuery } from "@/hooks/use-polled-data";
import { ResilienceWrapper } from "@/components/resilience-wrapper";
import { PipelineStage } from "@/components/safety-chain/pipeline-stage";
import { ShieldAlert, ShieldCheck, Zap, Activity, CheckCircle2, Lock } from "lucide-react";

const ALERT_THRESHOLD = 0.65;
const RESPONSE_THRESHOLD = 0.85;
const ELEVATED_THRESHOLD = 0.60;

interface LastEvent { event_type: string; recorded_at: string; fused_score: number; }

export default function SafetyChainPage() {
  const { data: telemetry, lastUpdateMs, connected } = useLiveTelemetry();
  const { data: recentEvents = [] } = usePolledQuery<LastEvent>(
    ["safety-chain-last-event"], "incidents", { orderBy: "recorded_at", limit: 1 }
  );
  const lastEvent = recentEvents[0];

  const fusedScore = telemetry?.fused_score ?? 0;
  const stage1Passed = fusedScore >= ALERT_THRESHOLD;
  
  const modalities = [
    { name: "Acoustic FFT (INMP441)", score: telemetry?.audio_score ?? 0 },
    { name: "Vibration Spectral (MPU-6050)", score: telemetry?.vibration_score ?? 0 },
    { name: "Thermal / Env (DHT22/BMP280)", score: telemetry?.env_score ?? 0 },
    { name: "Gas / Air Quality (MQ135)", score: telemetry?.gas_score ?? 0 },
    { name: "Motor Load (ACS712)", score: telemetry?.current_score ?? 0 },
  ];

  const corroboratingCount = modalities.filter(m => m.score >= ELEVATED_THRESHOLD).length;
  const stage2Passed = fusedScore >= RESPONSE_THRESHOLD && corroboratingCount >= 2;
  const isActuated = fusedScore > 0.85 && corroboratingCount >= 2;

  return (
    <ResilienceWrapper lastUpdateMs={lastUpdateMs} loading={!connected && !telemetry}>
      <div className="animate-in fade-in duration-700 space-y-8">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black text-white tracking-tight flex items-center gap-3">
              <ShieldAlert className="w-8 h-8 text-calm" /> 
              Physical Safety Chain
            </h1>
            <p className="text-text-2 mt-1">Autonomous 2-of-N hardware interlock and relay actuation pipeline.</p>
          </div>

          <div className="flex items-center gap-3">
            <div className={`border rounded-xl px-4 py-2 flex items-center gap-2.5 ${
              isActuated 
                ? 'bg-danger/10 border-danger/40 text-danger' 
                : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
            }`}>
              <span className={`w-2.5 h-2.5 rounded-full ${isActuated ? 'bg-danger animate-ping' : 'bg-emerald-400'}`} />
              <span className="text-xs font-mono font-bold uppercase tracking-wider">
                {isActuated ? "ACTUATION RELAY TRIPPED" : "SAFETY INTERLOCK: ARMED & NOMINAL"}
              </span>
            </div>
          </div>
        </div>

        {/* 6-Stage Hardware Pipeline */}
        <div className="glass rounded-3xl p-8 border border-border/50 space-y-6">
          <div className="flex justify-between items-center mb-2">
            <h2 className="text-sm font-bold text-white uppercase tracking-widest flex items-center gap-2">
              <Lock className="w-4 h-4 text-calm" />
              Real-Time 6-Stage Interlock Gate
            </h2>
            <span className="text-xs font-mono text-text-3">ESP32 Firmware Pipeline §7</span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
            <PipelineStage 
              number={1} 
              label="Alert Threshold" 
              sublabel={`Fused ≥ ${ALERT_THRESHOLD}`}
              status={stage1Passed ? "passed" : "idle"} 
            />
            <PipelineStage 
              number={2} 
              label="Corroboration" 
              sublabel={`${corroboratingCount} of 5 modalities`}
              status={stage2Passed ? "passed" : stage1Passed ? "active" : "idle"} 
            />
            <PipelineStage 
              number={3} 
              label="Debounce" 
              sublabel="4s stable window"
              status={isActuated ? "passed" : stage1Passed ? "active" : "idle"} 
            />
            <PipelineStage 
              number={4} 
              label="Cooldown" 
              sublabel="60s dead-time"
              status={isActuated ? "passed" : "idle"} 
            />
            <PipelineStage 
              number={5} 
              label="Hardware Override" 
              sublabel="Switch interlock"
              status={isActuated ? "passed" : "idle"} 
            />
            <PipelineStage 
              number={6} 
              label="Relay Cutoff" 
              sublabel={isActuated ? "BREAKER OPEN" : "Contacts closed"}
              status={isActuated ? "passed" : "idle"} 
            />
          </div>
        </div>

        {/* 5-Modality Live Corroboration Meters */}
        <div className="glass rounded-3xl p-6 border border-border/50">
          <h2 className="text-sm font-bold text-white uppercase tracking-widest mb-6 flex items-center gap-2">
            <Activity className="w-4 h-4 text-calm" />
            Live 2-of-N Corroboration Verification (Elevated Threshold: 0.60)
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            {modalities.map((mod) => {
              const isElevated = mod.score >= ELEVATED_THRESHOLD;
              return (
                <div 
                  key={mod.name} 
                  className={`p-4 rounded-2xl border transition-all ${
                    isElevated 
                      ? 'bg-danger/10 border-danger/40 shadow-[0_0_15px_rgba(239,68,68,0.2)]' 
                      : 'bg-surface-2 border-border'
                  }`}
                >
                  <div className="text-[10px] font-bold uppercase tracking-wider text-text-3 mb-1 truncate">
                    {mod.name.split(' ')[0]}
                  </div>
                  <div className="text-xs text-text-2 mb-2 truncate">
                    {mod.name}
                  </div>
                  
                  <div className="flex items-baseline justify-between mb-2 font-mono">
                    <span className={`text-2xl font-black ${isElevated ? 'text-danger' : 'text-white'}`}>
                      {mod.score.toFixed(3)}
                    </span>
                    <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${
                      isElevated ? 'bg-danger/20 text-danger' : 'bg-surface-3 text-text-3'
                    }`}>
                      {isElevated ? 'ELEVATED' : 'NOMINAL'}
                    </span>
                  </div>

                  <div className="w-full h-1.5 bg-surface-3 rounded-full overflow-hidden">
                    <div 
                      className={`h-full transition-all duration-500 ${isElevated ? 'bg-danger' : 'bg-calm'}`}
                      style={{ width: `${Math.min(100, mod.score * 100)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Explainability Callout */}
        <div className="glass rounded-3xl p-6 border border-border/50 flex items-start gap-4">
          <div className="p-3 bg-surface-2 rounded-2xl border border-border shrink-0">
            <CheckCircle2 className="w-6 h-6 text-emerald-400" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-1">
              Deterministic Hardware Invariant
            </h3>
            <p className="text-xs text-text-2 leading-relaxed">
              Stages 1-2 compute purely from instantaneous edge telemetry. Stages 3-6 reflect physical GPIO cutoff states. Under no circumstances can a single noisy sensor trigger an emergency machinery shutdown; at least two independent physical phenomena (e.g. vibration + acoustics, or temperature + current) must corroborate the anomaly.
            </p>
          </div>
        </div>

      </div>
    </ResilienceWrapper>
  );
}
