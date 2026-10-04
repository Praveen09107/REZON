"use client";

import { useState } from "react";
import { Play, RotateCcw, AlertTriangle, Flame, Activity } from "lucide-react";

export default function DemoControlPage() {
  const [status, setStatus] = useState<string | null>(null);

  const injectScenario = async (scenario: string) => {
    try {
      setStatus(`Injecting ${scenario}...`);
      const res = await fetch("/api/scenario", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scenario }),
      });
      if (res.ok) {
        setStatus(`Scenario "${scenario}" injected successfully.`);
        setTimeout(() => setStatus(null), 3000);
      } else {
        setStatus("Failed to inject scenario.");
      }
    } catch (e) {
      setStatus("Error injecting scenario.");
    }
  };

  return (
    <div className="max-w-4xl mx-auto py-12 px-6">
      <div className="mb-8 border-b border-border pb-6">
        <h1 className="text-3xl font-bold text-calm text-glow mb-2 flex items-center gap-3">
          <Activity className="w-8 h-8" />
          Virtual Edge Control Panel
        </h1>
        <p className="text-text-2">
          "Wizard of Oz" interface to dynamically inject scenarios into the Python Stateful Simulator. 
          The Next.js frontend and Supabase edge functions are unaware this is simulated data.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Scenario A */}
        <div className="glass glass-hover rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-lg bg-elevated-bg text-elevated">
              <RotateCcw className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-bold text-text">Bearing Degradation</h3>
          </div>
          <p className="text-sm text-text-3 mb-6 min-h-[60px]">
            Gradually degrades the vibration baseline and IDNN audio confidence over 3 minutes. Causes an organic Actuation event.
          </p>
          <button 
            onClick={() => injectScenario("bearing_failure")}
            className="w-full py-2.5 rounded-xl bg-surface-2 hover:bg-white/10 border border-border text-sm font-medium transition-colors flex items-center justify-center gap-2"
          >
            <Play className="w-4 h-4" /> Trigger Degradation
          </button>
        </div>

        {/* Scenario B */}
        <div className="glass glass-hover rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-lg bg-danger-bg text-danger">
              <Flame className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-bold text-text">Overheating / Fire</h3>
          </div>
          <p className="text-sm text-text-3 mb-6 min-h-[60px]">
            Causes a drastic spike in MQ135 gas readings and DHT22 temperature. Demonstrates multi-modal 2-of-N response.
          </p>
          <button 
            onClick={() => injectScenario("overheating")}
            className="w-full py-2.5 rounded-xl bg-surface-2 hover:bg-white/10 border border-border text-sm font-medium transition-colors flex items-center justify-center gap-2"
          >
            <Play className="w-4 h-4" /> Trigger Overheating
          </button>
        </div>
        
        {/* Scenario C */}
        <div className="glass glass-hover rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-lg bg-calm-bg text-calm">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-bold text-text">The False Alarm</h3>
          </div>
          <p className="text-sm text-text-3 mb-6 min-h-[60px]">
            Massive sudden spike in Audio confidence, but Vibration and Current stay steady. Proves the 2-of-N logic rejects false positives.
          </p>
          <button 
            onClick={() => injectScenario("false_alarm")}
            className="w-full py-2.5 rounded-xl bg-surface-2 hover:bg-white/10 border border-border text-sm font-medium transition-colors flex items-center justify-center gap-2"
          >
            <Play className="w-4 h-4" /> Trigger False Alarm
          </button>
        </div>

        {/* Reset */}
        <div className="glass glass-hover rounded-2xl p-6 flex flex-col justify-center">
          <h3 className="text-lg font-bold text-text mb-4 text-center">System Reset</h3>
          <p className="text-sm text-text-3 mb-6 text-center">
            Restores the virtual environment to a healthy state (Motor ON, baselines normal).
          </p>
          <button 
            onClick={() => injectScenario("reset")}
            className="w-full py-3 rounded-xl bg-calm text-bg font-bold shadow-[0_0_20px_rgba(6,182,212,0.4)] hover:shadow-[0_0_30px_rgba(6,182,212,0.6)] transition-all"
          >
            Reset Environment
          </button>
        </div>
      </div>

      {status && (
        <div className="mt-8 p-4 rounded-xl border border-calm bg-calm-bg text-calm text-center animate-in fade-in slide-in-from-bottom-4">
          {status}
        </div>
      )}
    </div>
  );
}
