"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { useLiveTelemetry } from "@/hooks/use-live-telemetry";
import { ResilienceWrapper } from "@/components/resilience-wrapper";
import { AnomalyControlPanel } from "@/components/digital-twin/control-panel";
import { MachineHealthCard } from "@/components/digital-twin/machine-health-card";
import { CCTVFeed } from "@/components/digital-twin/cctv-feed";
import { Spectrogram } from "@/components/digital-twin/spectrogram";
import { HexDump } from "@/components/digital-twin/hex-dump";
import { NetworkGraph } from "@/components/digital-twin/network-graph";
import { AnomalyTelemetryStrip } from "@/components/digital-twin/anomaly-telemetry-strip";
import { Server, Activity, ShieldAlert, Cpu, Network, Zap, Flame, AlertTriangle, Volume2, RotateCcw, Radio, Sparkles, ArrowRight, Clock } from "lucide-react";
import { useFluctuatingValue } from "@/hooks/use-fluctuating-value";
import { usePolledQuery } from "@/hooks/use-polled-data";

const QUICK_SCENARIOS = [
  { id: "bearing_failure", name: "Bearing Spall (BPFO)", icon: Zap, color: "text-danger border-danger/60 bg-danger/10 hover:bg-danger/20", activeBg: "bg-danger text-white border-danger shadow-[0_0_20px_rgba(239,68,68,0.5)]" },
  { id: "overheating", name: "Thermal Runaway", icon: Flame, color: "text-amber-400 border-amber-500/60 bg-amber-500/10 hover:bg-amber-500/20", activeBg: "bg-amber-500 text-black border-amber-500 shadow-[0_0_20px_rgba(245,158,11,0.5)]" },
  { id: "fire", name: "Gas / VOC Leak", icon: AlertTriangle, color: "text-purple-400 border-purple-500/60 bg-purple-500/10 hover:bg-purple-500/20", activeBg: "bg-purple-600 text-white border-purple-600 shadow-[0_0_20px_rgba(147,51,234,0.5)]" },
  { id: "false_alarm", name: "Transient Clang (1-of-N)", icon: Volume2, color: "text-cyan-400 border-cyan-500/60 bg-cyan-500/10 hover:bg-cyan-500/20", activeBg: "bg-cyan-600 text-white border-cyan-600 shadow-[0_0_20px_rgba(6,182,212,0.5)]" },
];

export default function HomePage() {
  const { data, lastUpdateMs } = useLiveTelemetry();
  const [activeScenario, setActiveScenario] = useState<string | null>(null);
  const [isInjecting, setIsInjecting] = useState<boolean>(false);
  
  // Dynamic fluctuating demo values
  const nominalHealth = useFluctuatingValue(98.4, 0.4, 1200);
  
  // Fetch live incident count
  const { data: incidents = [] } = usePolledQuery<any>(['incidents-count'], 'incidents');
  const openIncidents = incidents.length;

  // Poll current scenario from backend
  useEffect(() => {
    const checkState = async () => {
      try {
        const res = await fetch("/api/control");
        const json = await res.json();
        if (json.success && json.data) {
          setActiveScenario(json.data.scenario);
        }
      } catch (err) {}
    };
    checkState();
    const int = setInterval(checkState, 2000);
    return () => clearInterval(int);
  }, []);

  const triggerScenario = async (scenario: string | null) => {
    setIsInjecting(true);
    setActiveScenario(scenario);
    try {
      await fetch("/api/control", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scenario: scenario ?? "reset" })
      });
    } catch (err) {
      console.error(err);
    } finally {
      setIsInjecting(false);
    }
  };

  const fused = data?.fused_score ?? 0.08;
  const isCritical = fused > 0.85;
  const isAnomalous = fused > 0.70;
  const isFalseAlarm = (data?.audio_score ?? 0) > 0.8 && fused < 0.35;

  // Compute live dynamic asset health
  const liveHealth = isCritical ? Math.max(12, 100 - fused * 88).toFixed(1)
    : isAnomalous ? Math.max(45, 100 - fused * 55).toFixed(1)
    : nominalHealth.toFixed(1);

  // Determine which 2 modalities corroborated
  let corroborationText = "5 MODALITIES NOMINAL";
  if (isCritical || isAnomalous) {
    if (data?.vibration_score > 0.5 && data?.audio_score > 0.5) corroborationText = "VIB (3.8g) + ACOUSTIC (92dB)";
    else if (data?.env_score > 0.5 && data?.gas_score > 0.5) corroborationText = `TEMP (${(data?.env_temp ?? 50).toFixed(0)}°C) + VOC (${((data?.gas_score ?? 0.8)*350).toFixed(0)} PPM)`;
    else if (data?.gas_score > 0.5) corroborationText = `VOC (${((data?.gas_score ?? 0.8)*350).toFixed(0)} PPM) + THERMAL`;
    else corroborationText = "MULTI-MODAL HARMONIC DRIFT";
  } else if (isFalseAlarm) {
    corroborationText = "1-OF-N IMMUNE (ACOUSTIC TRANSIENT)";
  }

  return (
    <ResilienceWrapper lastUpdateMs={lastUpdateMs} loading={!data}>
      <div className="space-y-6 animate-in fade-in duration-700">
        
        {/* TOP COMMAND HEADER */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-black text-white tracking-tight">Global Fleet Command</h1>
              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider border ${
                isCritical ? 'bg-danger/20 border-danger text-danger animate-pulse shadow-[0_0_15px_rgba(239,68,68,0.5)]'
                : isAnomalous ? 'bg-warning/20 border-warning text-warning animate-pulse'
                : isFalseAlarm ? 'bg-cyan-500/20 border-cyan-500 text-cyan-400'
                : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
              }`}>
                {isCritical ? "CRITICAL TRIP ENGAGED" : isAnomalous ? "ANOMALY DRIFT ACTIVE" : isFalseAlarm ? "1-OF-N NOISE REJECTED" : "NOMINAL FLEET INTEGRITY"}
              </span>
            </div>
            <p className="text-text-2 mt-1">Multi-modal sensory fusion, real-time 3D twin kinematics, and fail-safe actuation.</p>
          </div>
          <div className="flex gap-3">
            <div className={`border rounded-xl px-4 py-2 flex items-center gap-3 transition-colors ${
              isCritical ? 'bg-danger/10 border-danger/80' : 'bg-surface border-border'
            }`}>
              <span className="relative flex h-3 w-3">
                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                  isCritical ? 'bg-danger' : 'bg-emerald-400'
                }`}></span>
                <span className={`relative inline-flex rounded-full h-3 w-3 ${
                  isCritical ? 'bg-danger' : 'bg-emerald-500'
                }`}></span>
              </span>
              <div className="flex flex-col">
                <span className="text-[10px] uppercase tracking-wider text-text-3 font-bold">Network Consensus</span>
                <span className={`text-xs font-mono font-bold ${isCritical ? 'text-danger' : 'text-emerald-400'}`}>
                  {isCritical ? "FAIL_SAFE_ACTUATED" : "1Hz_EDGE_STREAM_OK"}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* QUICK DEMONSTRATION & ANOMALY INJECTION BAR */}
        <div className={`glass rounded-2xl p-4 border transition-all duration-500 ${
          activeScenario ? 'border-danger/80 shadow-[0_0_35px_rgba(239,68,68,0.2)] bg-danger/[0.04]' : 'border-border/60 bg-surface/40'
        }`}>
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div className="flex items-center gap-2 shrink-0">
              <Sparkles className={`w-4 h-4 ${activeScenario ? 'text-danger animate-spin' : 'text-calm'}`} />
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-white">Live Hardware Simulation Engine:</span>
                <p className="text-[10px] text-text-3 font-mono">Inject authentic physical failure cascades to demonstrate 2-of-N cross-modal corroboration</p>
              </div>
            </div>

            {/* Scenario Buttons */}
            <div className="flex flex-wrap items-center gap-2">
              {QUICK_SCENARIOS.map((sc) => {
                const Icon = sc.icon;
                const isActive = activeScenario === sc.id;
                return (
                  <button
                    key={sc.id}
                    onClick={() => triggerScenario(isActive ? null : sc.id)}
                    disabled={isInjecting}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-mono font-bold transition-all border ${
                      isActive ? sc.activeBg : sc.color
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{sc.name}</span>
                    {isActive && <span className="ml-1 text-[10px] bg-black/40 px-1.5 py-0.5 rounded animate-pulse">ACTIVE</span>}
                  </button>
                );
              })}

              {activeScenario && (
                <button
                  onClick={() => triggerScenario(null)}
                  disabled={isInjecting}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-mono font-bold bg-white/10 hover:bg-white/20 text-white border border-white/20 transition-all ml-auto lg:ml-2"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Reset Nominal</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* AI ANOMALY PROGNOSTICS & RUL HORIZON BANNER */}
        <div className={`glass rounded-2xl p-4 border transition-all duration-500 relative overflow-hidden ${
          isCritical || isAnomalous
            ? 'border-danger/80 bg-danger/[0.06] shadow-[0_0_30px_rgba(239,68,68,0.25)]'
            : 'border-calm/30 bg-calm/[0.02]'
        }`}>
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className={`p-3 rounded-2xl ${isCritical || isAnomalous ? 'bg-danger/20 text-danger animate-pulse' : 'bg-calm/10 text-calm'}`}>
                <Sparkles className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-black text-white uppercase tracking-wider">AI Anomaly Prognostics &amp; RUL Horizon</h3>
                  <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border ${
                    isCritical ? 'bg-danger/20 border-danger text-danger animate-pulse' :
                    isAnomalous ? 'bg-warning/20 border-warning text-warning animate-pulse' :
                    'bg-emerald-500/10 border-emerald-500/40 text-emerald-400'
                  }`}>
                    {isCritical ? "CRITICAL TRIP PREDICTED" : isAnomalous ? "DEGRADATION IN PROGRESS" : "HEALTHY WEAR REGIME"}
                  </span>
                </div>
                <p className="text-xs text-text-3 font-mono mt-0.5">
                  ISO 13374 Prognostic Projection &bull; Target: Drive End Bearing (SKF 6205-2RSH) &bull; Confidence: 97.2%
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-6 text-xs font-mono">
              <div className="flex flex-col">
                <span className="text-[10px] text-text-3 uppercase tracking-wider font-bold">Remaining Useful Life (RUL)</span>
                <span className={`text-xl font-black ${isCritical || isAnomalous ? 'text-danger animate-pulse' : 'text-white'}`}>
                  {isCritical ? "18.4 hrs" : isAnomalous ? "42.1 hrs" : "2,418.9 hrs"}
                </span>
              </div>

              <div className="flex flex-col">
                <span className="text-[10px] text-text-3 uppercase tracking-wider font-bold">Projected Trip Countdown</span>
                <span className={`text-xl font-black ${isCritical ? 'text-danger animate-pulse' : isAnomalous ? 'text-amber-400 animate-pulse' : 'text-white'}`}>
                  {isCritical ? "T+41m 24s" : isAnomalous ? "T+3h 12m" : "> 30 Days"}
                </span>
              </div>

              <Link
                href="/prediction"
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs bg-calm/10 hover:bg-calm/20 text-calm border border-calm/30 transition-all hover:scale-[1.02] shadow-[0_0_15px_rgba(6,182,212,0.2)] ml-auto"
              >
                <span>Open Prognostics Studio</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        </div>

        {/* HIGH LEVEL DYNAMIC KPI GRID */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Card 1: Asset Health */}
          <div className={`glass rounded-2xl p-5 border-t-2 relative overflow-hidden transition-all duration-500 ${
            isCritical ? 'border-t-danger border-danger/60 shadow-[0_0_25px_rgba(239,68,68,0.25)]' :
            isAnomalous ? 'border-t-warning border-warning/50' : 'border-t-calm/50'
          }`}>
            <div className="flex justify-between items-start mb-4">
              <div className={`p-2 rounded-lg ${isCritical ? 'bg-danger/20 text-danger' : isAnomalous ? 'bg-warning/20 text-warning' : 'bg-calm/10 text-calm'}`}>
                <Activity className="w-5 h-5" />
              </div>
              <span className={`text-xs font-mono font-bold px-2 py-1 rounded ${
                isCritical ? 'bg-danger/20 text-danger animate-pulse border border-danger/40' :
                isAnomalous ? 'bg-warning/20 text-warning' : 'bg-calm/10 text-calm'
              }`}>
                {liveHealth}%
              </span>
            </div>
            <h3 className="text-2xl font-bold text-white mb-0.5">Asset Health</h3>
            <p className="text-[11px] text-text-3 font-mono">{isCritical ? "CRITICAL TRIP — INSPECTION REQUIRED" : isAnomalous ? "THERMAL/MECHANICAL DRIFT" : "NOMINAL KINEMATICS"}</p>
          </div>
          
          {/* Card 2: Fused Anomaly Threat */}
          <div className={`glass rounded-2xl p-5 border-t-2 relative overflow-hidden transition-all duration-500 ${
            isCritical ? 'border-t-danger border-danger/60 shadow-[0_0_25px_rgba(239,68,68,0.25)]' :
            isAnomalous ? 'border-t-warning border-warning/50' : isFalseAlarm ? 'border-t-cyan-500' : 'border-t-emerald-500/50'
          }`}>
            <div className="flex justify-between items-start mb-4">
              <div className={`p-2 rounded-lg ${isCritical ? 'bg-danger/20 text-danger' : isAnomalous ? 'bg-warning/20 text-warning' : 'bg-emerald-500/10 text-emerald-400'}`}>
                <ShieldAlert className="w-5 h-5" />
              </div>
              <span className={`text-xs font-mono font-bold px-2 py-1 rounded ${
                isCritical ? 'bg-danger text-white animate-pulse' :
                isAnomalous ? 'bg-warning text-black font-bold' :
                isFalseAlarm ? 'bg-cyan-500/20 text-cyan-400' : 'bg-emerald-500/10 text-emerald-400'
              }`}>
                {isCritical ? "ACTUATE (>0.85)" : isAnomalous ? "ALERT (>0.70)" : isFalseAlarm ? "FALSE ALARM" : "NOMINAL (<0.20)"}
              </span>
            </div>
            <h3 className="text-2xl font-bold font-mono text-white mb-0.5">{fused.toFixed(3)}</h3>
            <p className="text-[11px] text-text-3 font-mono">Fused 2-of-N Threat Index</p>
          </div>

          {/* Card 3: Physical Corroboration */}
          <div className={`glass rounded-2xl p-5 border-t-2 relative overflow-hidden transition-all duration-500 ${
            isCritical ? 'border-t-danger border-danger/60' : 'border-t-purple-500/50'
          }`}>
            <div className="flex justify-between items-start mb-4">
              <div className="p-2 bg-purple-500/10 rounded-lg"><Cpu className="w-5 h-5 text-purple-400" /></div>
              <span className={`text-xs font-bold px-2 py-1 rounded font-mono ${
                isCritical ? 'bg-danger/20 text-danger border border-danger/50 animate-pulse' :
                isFalseAlarm ? 'bg-cyan-500/20 text-cyan-400' : 'bg-purple-500/10 text-purple-400'
              }`}>
                {isCritical ? "2-OF-N TRIP" : isFalseAlarm ? "1-OF-N IMMUNE" : "CONSENSUS OK"}
              </span>
            </div>
            <h3 className="text-base font-bold text-white mb-0.5 truncate">{corroborationText}</h3>
            <p className="text-[11px] text-text-3 font-mono">Cross-Modal Verification</p>
          </div>

          {/* Card 4: Actuator & Incidents */}
          <div className={`glass rounded-2xl p-5 border-t-2 relative overflow-hidden transition-all duration-500 ${
            isCritical ? 'border-t-danger border-danger/60' : 'border-t-blue-500/50'
          }`}>
            <div className="flex justify-between items-start mb-4">
              <div className="p-2 bg-blue-500/10 rounded-lg"><Network className="w-5 h-5 text-blue-400" /></div>
              <span className={`text-xs font-bold px-2 py-1 rounded font-mono ${
                isCritical ? 'bg-danger text-white' : 'bg-blue-500/10 text-blue-400'
              }`}>
                {isCritical ? "LOCKDOWN" : "DISENGAGED"}
              </span>
            </div>
            <h3 className="text-2xl font-bold text-white mb-0.5">{openIncidents} Incidents</h3>
            <p className="text-[11px] text-text-3 font-mono">{isCritical ? "HARDWARE INTERRUPT ACTIVE" : "Edge Microcontroller Synced"}</p>
          </div>
        </div>

        {/* PRIMARY ASSET DRILLDOWN */}
        <div className="mt-4 mb-2 flex items-center justify-between">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Server className="w-5 h-5 text-calm" />
            Active Fleet Detail: REZON-01
          </h2>
          <span className="text-xs font-mono text-text-3">Asset UID: e9b4-ind-drive-01 · 2,400 RPM</span>
        </div>

        {/* EXTREME VISUALS GRID */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Main 3D Twin Column */}
          <div className="lg:col-span-2 flex flex-col gap-6">
            {/* The WebGL 3D Model */}
            <MachineHealthCard telemetry={data} />
            
            {/* The 2-Column Split for Engineering Views */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 h-[280px]">
              {/* CCTV Feed with Bounding Boxes */}
              <CCTVFeed telemetry={data} />
              
              {/* Waterfall Spectrogram */}
              <Spectrogram telemetry={data} />
            </div>

            {/* Cross-Modal Physical Anomaly Telemetry & Safety Invariant Engine */}
            <AnomalyTelemetryStrip telemetry={data} />
          </div>

          {/* Right Column: Control & Deep Diagnostics */}
          <div className="flex flex-col gap-6">
            
            {/* Physics Network Graph */}
            <NetworkGraph telemetry={data} />

            {/* Hex Dump Inspector */}
            <div className="h-[280px]">
              <HexDump telemetry={data} />
            </div>

            {/* Anomaly Control Panel */}
            <div className="mt-auto">
              <AnomalyControlPanel />
            </div>

          </div>
        </div>

        {/* LIVE MULTI-AGENT INTELLIGENCE TICKER */}
        <div className={`glass rounded-2xl p-4 border transition-all duration-500 flex flex-col md:flex-row items-center justify-between gap-4 ${
          isCritical ? 'border-danger/80 bg-danger/[0.04]' : 'border-border/60'
        }`}>
          <div className="flex items-center gap-3">
            <span className="relative flex h-2.5 w-2.5 shrink-0">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                isCritical ? 'bg-danger' : 'bg-emerald-400'
              }`}></span>
              <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${
                isCritical ? 'bg-danger' : 'bg-emerald-500'
              }`}></span>
            </span>
            <span className="text-xs uppercase font-bold tracking-widest text-text-3 shrink-0">
              Agent Stream:
            </span>
            <div className="text-xs font-mono text-white truncate max-w-2xl">
              {isCritical ? (
                <span className="text-danger font-bold animate-pulse">
                  [Safety Controller] Critical 2-of-N trip corroborated — fused threat {fused.toFixed(3)}. Relay actuation command dispatched to edge coil.
                </span>
              ) : isAnomalous ? (
                <span className="text-warning font-bold animate-pulse">
                  [Diagnostician] Alert condition active — fused score {fused.toFixed(3)}. Corroborating cross-modal drift.
                </span>
              ) : isFalseAlarm ? (
                <span className="text-cyan-400 font-bold">
                  [Consensus Arbiter] Transient acoustic spike (95 dB) detected. 1-of-N isolation verified. Zero motor shudder. No trip dispatched.
                </span>
              ) : (
                <span className="text-calm font-medium">
                  [Watcher &amp; Diagnostician] All 5 transducers nominal (1Hz cadence) · Zero harmonic drift detected · MTBF 2,420h
                </span>
              )}
            </div>
          </div>

          <a 
            href="/timeline"
            className="text-xs font-mono text-calm hover:underline shrink-0 flex items-center gap-1"
          >
            Audit Log &rarr;
          </a>
        </div>

      </div>
    </ResilienceWrapper>
  );
}
