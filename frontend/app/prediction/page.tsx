"use client";
import { useState, useEffect } from "react";
import { useLiveTelemetry } from "@/hooks/use-live-telemetry";
import { ResilienceWrapper } from "@/components/resilience-wrapper";
import { PrognosticHorizonChart } from "@/components/prediction/prognostic-horizon-chart";
import { TransducerProgressionMatrix } from "@/components/prediction/transducer-progression-matrix";
import { SpectralProjection } from "@/components/prediction/spectral-projection";
import { PrescriptiveAdvisory } from "@/components/prediction/prescriptive-advisory";
import { 
  Sparkles, 
  TrendingUp, 
  Clock, 
  ShieldCheck, 
  AlertTriangle, 
  Cpu, 
  Radio, 
  Wrench, 
  Activity, 
  Zap, 
  Flame, 
  RotateCcw,
  Sliders,
  ChevronDown
} from "lucide-react";
import { useFluctuatingValue } from "@/hooks/use-fluctuating-value";

export default function PredictionPage() {
  const { data, lastUpdateMs } = useLiveTelemetry();
  
  // Forecast Horizon Selection
  const [horizon, setHorizon] = useState<"15m" | "1h" | "24h" | "7d">("1h");

  // Stealth Ingestion / Demo Degradation State
  const [isDegraded, setIsDegraded] = useState<boolean>(false);
  const [degradationProgress, setDegradationProgress] = useState<number>(0);
  const [showPresenterControls, setShowPresenterControls] = useState<boolean>(false);
  
  // Countdown timer for predicted boundary breach (starts at 42m 18s)
  const [countdownSeconds, setCountdownSeconds] = useState<number>(42 * 60 + 18);

  // Sync with backend /api/control state and telemetry
  useEffect(() => {
    const syncControl = async () => {
      try {
        const res = await fetch("/api/control");
        const json = await res.json();
        if (json.success && json.data) {
          const sc = json.data.scenario;
          if (sc && sc !== "reset" && sc !== "null") {
            setIsDegraded(true);
          } else if (sc === "reset" || sc === null) {
            if ((data?.fused_score ?? 0) < 0.5) {
              setIsDegraded(false);
            }
          }
        }
      } catch (err) {}
    };
    syncControl();
    const interval = setInterval(syncControl, 1500);
    return () => clearInterval(interval);
  }, [data?.fused_score]);

  // Auto-degrade if physical telemetry fused_score > 0.65
  useEffect(() => {
    if (data?.fused_score && data.fused_score > 0.65) {
      setIsDegraded(true);
    }
  }, [data?.fused_score]);

  // Master toggle function that controls both local UI state AND the physical simulator
  const toggleDegradation = async (targetState?: boolean) => {
    const nextState = targetState !== undefined ? targetState : !isDegraded;
    setIsDegraded(nextState);
    try {
      await fetch("/api/control", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scenario: nextState ? "bearing_failure" : "reset" }),
      });
    } catch (e) {
      console.error("Failed to sync scenario with backend simulator:", e);
    }
  };

  // Keyboard shortcut listener: Shift + P toggles the degradation cascade across the entire platform
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.shiftKey && (e.key === "P" || e.key === "p")) {
        e.preventDefault();
        toggleDegradation();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isDegraded]);

  // Smooth degradation progress interpolation over ~8 seconds
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isDegraded) {
      interval = setInterval(() => {
        setDegradationProgress(prev => {
          if (prev >= 1.0) return 1.0;
          return prev + 0.04;
        });
      }, 300);
    } else {
      interval = setInterval(() => {
        setDegradationProgress(prev => {
          if (prev <= 0) return 0;
          return prev - 0.08;
        });
      }, 300);
    }
    return () => clearInterval(interval);
  }, [isDegraded]);

  // Ticking countdown timer when degraded
  useEffect(() => {
    if (!isDegraded) {
      setCountdownSeconds(42 * 60 + 18);
      return;
    }
    const timer = setInterval(() => {
      setCountdownSeconds(s => (s > 10 ? s - 1 : 10));
    }, 1000);
    return () => clearInterval(timer);
  }, [isDegraded]);

  // Format countdown seconds into MM:SS
  const formatCountdown = (totalSec: number) => {
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${mins.toString().padStart(2, "0")}m ${secs.toString().padStart(2, "0")}s`;
  };

  // Dynamic fluctuating baseline values
  const nominalRul = useFluctuatingValue(2420, 12, 2000);
  const inferenceMs = useFluctuatingValue(1.18, 0.08, 400);

  // Compute live RUL based on degradation progress
  const currentRul = isDegraded
    ? Math.max(18.4, nominalRul * Math.pow(1 - degradationProgress * 0.992, 1.8))
    : nominalRul;

  return (
    <ResilienceWrapper lastUpdateMs={lastUpdateMs} loading={!data}>
      <div className="space-y-6 animate-in fade-in duration-700 pb-12">
        
        {/* Top Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-black text-white tracking-tight flex items-center gap-3">
                <Sparkles className="w-8 h-8 text-calm" />
                Anomaly Prediction &amp; Prognostics
              </h1>
              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider border ${
                isDegraded && degradationProgress > 0.4
                  ? 'bg-danger/20 border-danger text-danger animate-pulse shadow-[0_0_15px_rgba(239,68,68,0.5)]'
                  : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
              }`}>
                {isDegraded && degradationProgress > 0.4 ? "EARLY DEGRADATION DETECTED" : "NOMINAL RUL HORIZON"}
              </span>
            </div>
            <p className="text-text-2 mt-1 font-sans">
              Auto-regressive neural forecasting (ISO 13374), Monte Carlo confidence intervals, and prescriptive maintenance.
            </p>
          </div>

          {/* Right Toolbar with the Stealth Ingress Trigger */}
          <div className="flex items-center gap-3">
            
            {/* The "Secret" Stealth Ingress Trigger (Disguised naturally as live edge ingress) */}
            <button
              onClick={() => toggleDegradation()}
              title="Edge Ingress State (Tip: Press Shift + P to toggle degradation demo across the whole app)"
              className={`border rounded-xl px-4 py-2 flex items-center gap-3 transition-all cursor-pointer ${
                isDegraded
                  ? 'bg-danger/10 border-danger/80 shadow-[0_0_15px_rgba(239,68,68,0.3)]'
                  : 'bg-surface border-border hover:border-calm/50'
              }`}
            >
              <span className="relative flex h-3 w-3">
                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                  isDegraded ? 'bg-danger' : 'bg-emerald-400'
                }`}></span>
                <span className={`relative inline-flex rounded-full h-3 w-3 ${
                  isDegraded ? 'bg-danger' : 'bg-emerald-500'
                }`}></span>
              </span>
              <div className="flex flex-col text-left">
                <span className="text-[10px] uppercase tracking-wider text-text-3 font-bold font-mono">
                  {isDegraded ? "Ingress: Stress Active" : "Ingress: 1Hz Live Edge"}
                </span>
                <span className={`text-xs font-mono font-bold ${isDegraded ? 'text-danger' : 'text-emerald-400'}`}>
                  {isDegraded ? "ACCELERATED_DRIFT" : "NOMINAL_HORIZON"}
                </span>
              </div>
            </button>

            {/* Presenter drawer toggle button */}
            <button
              onClick={() => setShowPresenterControls(prev => !prev)}
              className="p-2.5 bg-surface border border-border hover:bg-surface-2 rounded-xl text-text-3 hover:text-white transition-colors"
              title="Presenter Scenario Controls"
            >
              <Sliders className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Presenter Scenario Drawer (Visible when toggled or testing) */}
        {showPresenterControls && (
          <div className="glass rounded-2xl p-4 border border-calm/40 bg-calm/[0.03] animate-in slide-in-from-top-2 duration-300">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs font-mono">
              <div className="flex items-center gap-2 text-calm">
                <Sliders className="w-4 h-4" />
                <span className="font-bold uppercase tracking-wider">Presenter Simulation Controls:</span>
                <span className="text-text-3">(Or use shortcut <kbd className="bg-black/60 px-1.5 py-0.5 rounded border border-white/20 text-white font-bold">Shift + P</kbd>)</span>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => toggleDegradation(false)}
                  className={`px-3 py-1.5 rounded-xl font-bold border transition-all ${
                    !isDegraded ? 'bg-emerald-500 text-black border-emerald-500' : 'bg-surface border-border text-text-3 hover:text-white'
                  }`}
                >
                  Baseline Nominal (2,420h)
                </button>
                <button
                  onClick={() => toggleDegradation(true)}
                  className={`px-3 py-1.5 rounded-xl font-bold border transition-all ${
                    isDegraded ? 'bg-danger text-white border-danger shadow-[0_0_15px_rgba(239,68,68,0.5)]' : 'bg-surface border-border text-danger hover:bg-danger/10'
                  }`}
                >
                  Trigger Degradation Cascade (42m Breach)
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Top 4 Prognostic Ribbon Metric Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          
          {/* Card 1: Remaining Useful Life (RUL) */}
          <div className={`glass rounded-2xl p-5 border-t-2 relative overflow-hidden transition-all duration-500 ${
            isDegraded && degradationProgress > 0.4
              ? 'border-t-danger border-danger/70 shadow-[0_0_25px_rgba(239,68,68,0.25)]'
              : 'border-t-calm/60'
          }`}>
            <div className="flex justify-between items-start mb-3">
              <span className="text-[10px] uppercase font-bold tracking-widest text-text-3 font-mono">
                Remaining Useful Life (RUL)
              </span>
              <div className={`p-1.5 rounded-lg ${isDegraded && degradationProgress > 0.4 ? 'bg-danger/20 text-danger' : 'bg-calm/10 text-calm'}`}>
                <Clock className="w-4 h-4" />
              </div>
            </div>
            <div className={`text-3xl font-black font-mono tracking-tight mb-1 ${
              isDegraded && degradationProgress > 0.4 ? 'text-danger animate-pulse' : 'text-white'
            }`}>
              {currentRul.toFixed(1)} <span className="text-base font-normal text-text-3">hrs</span>
            </div>
            <div className="flex items-center justify-between text-[11px] font-mono text-text-3">
              <span>{isDegraded && degradationProgress > 0.4 ? "CRITICAL OUTAGE RISK" : "Normal Machine Wear Envelope"}</span>
              <span className={`font-bold ${isDegraded ? 'text-danger' : 'text-emerald-400'}`}>
                {isDegraded ? "-98.4%" : "±12h"}
              </span>
            </div>
          </div>

          {/* Card 2: Projected Boundary Intercept (TTF) */}
          <div className={`glass rounded-2xl p-5 border-t-2 relative overflow-hidden transition-all duration-500 ${
            isDegraded && degradationProgress > 0.4
              ? 'border-t-amber-500 border-amber-500/70 shadow-[0_0_25px_rgba(245,158,11,0.2)]'
              : 'border-t-purple-500/60'
          }`}>
            <div className="flex justify-between items-start mb-3">
              <span className="text-[10px] uppercase font-bold tracking-widest text-text-3 font-mono">
                Projected Trip Countdown
              </span>
              <div className={`p-1.5 rounded-lg ${isDegraded ? 'bg-amber-500/20 text-amber-400' : 'bg-purple-500/10 text-purple-400'}`}>
                <TrendingUp className="w-4 h-4" />
              </div>
            </div>
            <div className={`text-3xl font-black font-mono tracking-tight mb-1 ${
              isDegraded ? 'text-amber-400 animate-pulse' : 'text-white'
            }`}>
              {isDegraded ? formatCountdown(countdownSeconds) : "> 30 Days"}
            </div>
            <div className="flex items-center justify-between text-[11px] font-mono text-text-3">
              <span>{isDegraded ? "Interlock Boundary Breach" : "Zero Predicted Trip"}</span>
              <span className="text-purple-300 font-bold font-mono">T+42m Intercept</span>
            </div>
          </div>

          {/* Card 3: Predicted Failure Mode */}
          <div className="glass rounded-2xl p-5 border-t-2 border-t-blue-500/60 relative overflow-hidden">
            <div className="flex justify-between items-start mb-3">
              <span className="text-[10px] uppercase font-bold tracking-widest text-text-3 font-mono">
                Predicted Failure Mode
              </span>
              <div className="p-1.5 rounded-lg bg-blue-500/10 text-blue-400">
                <Cpu className="w-4 h-4" />
              </div>
            </div>
            <div className="text-sm font-bold text-white mb-1 leading-snug line-clamp-1 hover:line-clamp-none">
              {isDegraded ? "BPFO Bearing Outer Race Spall" : "All Kinematic Bands Nominal"}
            </div>
            <div className="flex items-center justify-between text-[11px] font-mono text-text-3">
              <span>Target: REZON-01</span>
              <span className="text-calm font-bold">97.2% Confidence</span>
            </div>
          </div>

          {/* Card 4: Prescriptive Countermeasure */}
          <div className="glass rounded-2xl p-5 border-t-2 border-t-emerald-500/60 relative overflow-hidden">
            <div className="flex justify-between items-start mb-3">
              <span className="text-[10px] uppercase font-bold tracking-widest text-text-3 font-mono">
                Prescriptive Advisory
              </span>
              <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400">
                <Wrench className="w-4 h-4" />
              </div>
            </div>
            <div className="text-sm font-bold text-white mb-1 leading-snug line-clamp-1 hover:line-clamp-none">
              {isDegraded ? "De-rate RPM to 1,200" : "Routine Operations"}
            </div>
            <div className="flex items-center justify-between text-[11px] font-mono text-text-3">
              <span>{isDegraded ? "Extends RUL by +350%" : "Zero Load Throttling"}</span>
              <span className="text-emerald-400 font-bold">WO-PRED-4091</span>
            </div>
          </div>

        </div>

        {/* Master Prognostic Horizon Chart */}
        <PrognosticHorizonChart
          isDegraded={isDegraded}
          degradationProgress={degradationProgress}
          horizon={horizon}
          onHorizonChange={setHorizon}
          telemetry={data}
        />

        {/* 5-Transducer Risk Progression Matrix */}
        <TransducerProgressionMatrix
          isDegraded={isDegraded}
          degradationProgress={degradationProgress}
          telemetry={data}
        />

        {/* 2-Column Split: FFT Spectral Growth & Prescriptive Countermeasures */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <SpectralProjection 
            isDegraded={isDegraded} 
            degradationProgress={degradationProgress} 
          />
          <PrescriptiveAdvisory 
            isDegraded={isDegraded} 
            degradationProgress={degradationProgress} 
            rulHours={currentRul} 
          />
        </div>

        {/* Multi-Agent Prognostic Intelligence Ticker */}
        <div className={`glass rounded-2xl p-4 border transition-all duration-500 flex flex-col md:flex-row items-center justify-between gap-4 ${
          isDegraded ? 'border-amber-500/80 bg-amber-500/[0.03]' : 'border-border/60'
        }`}>
          <div className="flex items-center gap-3">
            <span className="relative flex h-2.5 w-2.5 shrink-0">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                isDegraded ? 'bg-danger' : 'bg-emerald-400'
              }`}></span>
              <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${
                isDegraded ? 'bg-danger' : 'bg-emerald-500'
              }`}></span>
            </span>
            <span className="text-xs uppercase font-bold tracking-widest text-text-3 shrink-0 font-mono">
              Forecaster Agent Stream:
            </span>
            <div className="text-xs font-mono text-white truncate max-w-2xl">
              {isDegraded ? (
                <span className="text-amber-400 font-bold animate-pulse">
                  [Forecaster] Continuous degradation detected: 2.4kHz harmonic sidebands expanding. Intercept at T+42m. Pre-authorized Work Order #WO-PRED-4091 staged.
                </span>
              ) : (
                <span className="text-calm font-medium">
                  [Forecaster] Auto-regressive horizon nominal (MTBF 2,420h). Zero predictive boundary intercept within next 720h window.
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3 text-xs font-mono text-text-3 shrink-0">
            <span>Inference: <strong className="text-white">{inferenceMs.toFixed(2)}ms</strong></span>
            <span>Cadence: <strong className="text-calm">4.0 Hz</strong></span>
          </div>
        </div>

      </div>
    </ResilienceWrapper>
  );
}
