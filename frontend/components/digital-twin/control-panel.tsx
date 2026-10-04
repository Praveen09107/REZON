"use client";
import { useState, useEffect } from "react";
import { Zap, Flame, Settings2, Power, AlertTriangle, ShieldCheck, Radio, Sparkles, Volume2 } from "lucide-react";

const SCENARIOS = [
  {
    id: "bearing_failure",
    name: "Bearing Failure (BPFO)",
    subtitle: "Vib 3.8g chatter + Acoustic 2.4kHz harmonic surge",
    modalities: "Vib + Audio",
    corroboration: "2-of-N Tripped",
    icon: Zap,
    colorClass: "border-danger text-danger bg-danger/10 hover:bg-danger/20",
    activeClass: "bg-danger text-white border-danger shadow-[0_0_25px_rgba(239,68,68,0.5)]"
  },
  {
    id: "overheating",
    name: "Thermal Runaway",
    subtitle: "Casing temp +32°C surge & cooling fan stall",
    modalities: "Temp + Gas",
    corroboration: "2-of-N Tripped",
    icon: Flame,
    colorClass: "border-warning text-warning bg-warning/10 hover:bg-warning/20",
    activeClass: "bg-warning text-black border-warning shadow-[0_0_25px_rgba(245,158,11,0.5)]"
  },
  {
    id: "fire",
    name: "Gas / VOC Leak",
    subtitle: "Volatile organic compounds surge to 380 PPM",
    modalities: "Gas + Thermal",
    corroboration: "2-of-N Tripped",
    icon: AlertTriangle,
    colorClass: "border-purple-500 text-purple-400 bg-purple-500/10 hover:bg-purple-500/20",
    activeClass: "bg-purple-600 text-white border-purple-600 shadow-[0_0_25px_rgba(147,51,234,0.5)]"
  },
  {
    id: "false_alarm",
    name: "Transient Clang (False Alarm)",
    subtitle: "Acoustic 95dB tool drop · 1-of-N immunity test",
    modalities: "Audio Only",
    corroboration: "IMMUNE (NO TRIP)",
    icon: Volume2,
    colorClass: "border-cyan-500 text-cyan-400 bg-cyan-500/10 hover:bg-cyan-500/20",
    activeClass: "bg-cyan-600 text-white border-cyan-600 shadow-[0_0_25px_rgba(6,182,212,0.5)]"
  }
];

export function AnomalyControlPanel() {
  const [activeScenario, setActiveScenario] = useState<string | null>(null);
  const [elapsedSec, setElapsedSec] = useState<number>(0);

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

  // Track elapsed seconds during active injection
  useEffect(() => {
    if (!activeScenario) {
      setElapsedSec(0);
      return;
    }
    const timer = setInterval(() => {
      setElapsedSec(s => s + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [activeScenario]);

  const injectScenario = async (scenario: string | null) => {
    setActiveScenario(scenario);
    setElapsedSec(0);
    try {
      await fetch("/api/control", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scenario: scenario ?? "reset" })
      });
    } catch (err) {
      console.error(err);
    }
  };

  const activeObj = SCENARIOS.find(s => s.id === activeScenario);

  return (
    <div className={`glass rounded-3xl p-6 border transition-all duration-500 relative overflow-hidden group ${
      activeScenario ? 'border-danger/80 shadow-[0_0_40px_rgba(239,68,68,0.2)]' : 'border-border/50'
    }`}>
      {/* Background glow */}
      <div className={`absolute inset-0 bg-gradient-to-br pointer-events-none transition-opacity duration-700 ${
        activeScenario ? 'from-danger/10 to-transparent opacity-100' : 'from-calm/5 to-transparent opacity-40'
      }`} />
      
      {/* Header */}
      <div className="flex items-center justify-between mb-5 relative z-10">
        <div className="flex items-center gap-2">
          <Settings2 className={`w-5 h-5 ${activeScenario ? 'text-danger animate-spin' : 'text-calm'}`} />
          <div>
            <h2 className="text-base font-bold text-white uppercase tracking-wider">
              Command &amp; Control
            </h2>
            <p className="text-[10px] text-text-3 font-mono">
              Live Edge Hardware Failure Injection
            </p>
          </div>
        </div>

        {activeScenario ? (
          <span className="flex items-center gap-2 text-xs font-mono font-bold uppercase text-danger bg-danger/10 border border-danger/40 px-3 py-1 rounded-full animate-pulse shadow-[0_0_15px_rgba(239,68,68,0.4)]">
            <Radio className="w-3.5 h-3.5 animate-ping" />
            LIVE INJECTION: {elapsedSec}s
          </span>
        ) : (
          <span className="flex items-center gap-1.5 text-[11px] font-mono font-bold uppercase text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-3 py-1 rounded-full">
            <ShieldCheck className="w-3.5 h-3.5" />
            IDLE / NOMINAL
          </span>
        )}
      </div>

      {/* Active Injection HUD */}
      {activeScenario && activeObj && (
        <div className="mb-4 p-4 rounded-2xl bg-[#050505] border border-danger/50 relative z-10 animate-in fade-in duration-300">
          <div className="flex items-start justify-between mb-2">
            <div>
              <div className="text-[10px] uppercase font-bold text-danger tracking-widest flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5" /> Active Physical Simulation
              </div>
              <div className="text-base font-black text-white mt-0.5">
                {activeObj.name}
              </div>
            </div>
            <span className="text-[10px] font-mono uppercase bg-danger/20 text-danger border border-danger/40 px-2 py-0.5 rounded font-bold">
              {activeObj.corroboration}
            </span>
          </div>

          <p className="text-xs text-text-2 font-mono leading-relaxed mb-3">
            {activeObj.subtitle}. Watch the 3D twin vibrate, spectrogram harmonics burst, and CCTV target box lock on.
          </p>

          <button
            onClick={() => injectScenario(null)}
            className="w-full flex items-center justify-center gap-2 p-3 rounded-xl bg-danger hover:bg-danger/80 text-white font-bold text-xs uppercase tracking-wider transition-all shadow-[0_0_20px_rgba(239,68,68,0.6)]"
          >
            <Power className="w-4 h-4" />
            Abort Injection (Reset to Nominal)
          </button>
        </div>
      )}

      {/* Scenario Buttons Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 relative z-10">
        {SCENARIOS.map((sc) => {
          const Icon = sc.icon;
          const isActive = activeScenario === sc.id;

          return (
            <button
              key={sc.id}
              onClick={() => injectScenario(isActive ? null : sc.id)}
              className={`p-3.5 rounded-2xl border text-left transition-all duration-300 flex flex-col justify-between group ${
                isActive ? sc.activeClass : 'bg-surface-2/80 hover:bg-surface-3 border-border hover:border-white/30 text-white'
              }`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <Icon className={`w-4 h-4 ${isActive ? 'text-inherit' : 'text-calm group-hover:scale-110 transition-transform'}`} />
                <span className={`text-[9px] font-mono uppercase font-bold px-1.5 py-0.5 rounded border ${
                  isActive ? 'border-white/30 bg-black/30' : 'border-border text-text-3 bg-surface'
                }`}>
                  {sc.modalities}
                </span>
              </div>

              <div>
                <div className="text-xs font-bold font-mono tracking-tight text-white mb-0.5">
                  {sc.name}
                </div>
                <div className={`text-[10px] leading-tight line-clamp-1 ${isActive ? 'text-white/80' : 'text-text-3'}`}>
                  {sc.subtitle}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Manual Full Reset bar if nominal */}
      {!activeScenario && (
        <div className="mt-4 pt-3 border-t border-border/40 flex items-center justify-between relative z-10 text-[11px] font-mono text-text-3">
          <span>Click any failure mode to trigger live demo.</span>
          <button 
            onClick={() => injectScenario(null)}
            className="hover:text-calm transition-colors flex items-center gap-1 text-[10px] uppercase font-bold"
          >
            <Power className="w-3 h-3" /> Re-sync
          </button>
        </div>
      )}
    </div>
  );
}
