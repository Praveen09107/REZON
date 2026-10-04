"use client";
import { useState } from "react";
import { GitCompare, SlidersHorizontal, AlertTriangle, CheckCircle2 } from "lucide-react";
import { motion } from "framer-motion";
import { useFluctuatingValue } from "@/hooks/use-fluctuating-value";

export default function SandboxPage() {
  const [threshold, setThreshold] = useState(0.85);

  // Simulated metrics based on the threshold, with realistic mathematical jitter added
  const baseFalsePositives = Math.max(0, (0.95 - threshold) * 120);
  const falsePositives = Math.round(useFluctuatingValue(baseFalsePositives, baseFalsePositives * 0.1, 1500));
  
  const caughtAnomalies = Math.min(100, Math.round((threshold / 0.85) * 100));
  
  const baseMTBF = 2400 * (0.85 / threshold);
  const MTBF_hours = Math.round(useFluctuatingValue(baseMTBF, baseMTBF * 0.05, 2000));

  return (
    <div className="animate-in fade-in duration-700 space-y-8">
      
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-white tracking-tight flex items-center gap-3">
            <GitCompare className="w-8 h-8 text-calm" /> 
            Threshold Sandbox
          </h1>
          <p className="text-text-2 mt-1">Simulate fusion threshold adjustments against historical data.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Controls */}
        <div className="glass rounded-3xl p-6 border border-border/50 flex flex-col justify-between">
          <div>
            <h2 className="text-sm font-bold text-white uppercase tracking-widest mb-6 flex items-center gap-2">
              <SlidersHorizontal className="w-4 h-4 text-calm" /> Actuation Threshold
            </h2>
            
            <div className="space-y-6">
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-text-2">Fused Score Threshold</span>
                  <span className="text-white font-mono">{threshold.toFixed(2)}</span>
                </div>
                <input 
                  type="range" 
                  min="0.50" max="0.99" step="0.01" 
                  value={threshold}
                  onChange={(e) => setThreshold(parseFloat(e.target.value))}
                  className="w-full accent-calm"
                />
              </div>
              
              <div className="p-4 bg-surface-2 rounded-xl border border-border">
                <p className="text-xs text-text-3 leading-relaxed">
                  Lowering the threshold increases sensitivity (more caught anomalies, but higher false positives). 
                  Raising it reduces false alarms but risks missing early failure indicators.
                </p>
              </div>
            </div>
          </div>
          
          <button className="w-full bg-calm hover:bg-calm/80 text-black font-bold py-3 rounded-xl mt-6 transition-colors">
            Deploy to Shadow Mode
          </button>
        </div>

        {/* Results / Simulation */}
        <div className="lg:col-span-2 glass rounded-3xl p-6 border border-border/50">
          <h2 className="text-sm font-bold text-white uppercase tracking-widest mb-6">
            Simulation Results (Last 30 Days)
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <div className="bg-surface-2 p-4 rounded-xl border border-border">
              <div className="text-xs text-text-3 uppercase mb-1">True Positives Caught</div>
              <div className="text-3xl font-black text-emerald-400">{caughtAnomalies}%</div>
            </div>
            <div className="bg-surface-2 p-4 rounded-xl border border-border">
              <div className="text-xs text-text-3 uppercase mb-1">False Positives</div>
              <div className="text-3xl font-black text-warning">{falsePositives}</div>
            </div>
            <div className="bg-surface-2 p-4 rounded-xl border border-border">
              <div className="text-xs text-text-3 uppercase mb-1">Est. MTBF Impact</div>
              <div className="text-3xl font-black text-calm">{MTBF_hours}h</div>
            </div>
          </div>

          {/* Visualizing the threshold curve */}
          <div className="relative h-48 bg-surface-2 rounded-xl border border-border overflow-hidden p-4">
            <div className="absolute inset-0 opacity-20 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-calm/20 to-transparent" />
            
            {/* Simulated Data Points */}
            <div className="absolute bottom-4 left-4 right-4 h-32 flex items-end justify-between gap-1">
              {Array.from({ length: 40 }).map((_, i) => {
                // Generate a fake bell curve of anomaly scores
                const x = i / 40;
                const score = 0.5 + Math.sin(x * Math.PI) * 0.4 + (Math.random() * 0.1);
                const isTripped = score >= threshold;
                
                return (
                  <motion.div 
                    key={i}
                    layout
                    className={`w-full rounded-t-sm ${isTripped ? 'bg-danger' : 'bg-calm'}`}
                    style={{ height: `${score * 100}%`, opacity: isTripped ? 1 : 0.5 }}
                    transition={{ type: "spring", bounce: 0, duration: 0.5 }}
                  />
                );
              })}
            </div>
            
            {/* Threshold Line */}
            <motion.div 
              className="absolute left-0 right-0 border-t-2 border-dashed border-warning z-10"
              style={{ bottom: `calc(${threshold * 100}% - 16px)` }}
              animate={{ bottom: `calc(${threshold * 100}% - 16px)` }}
              transition={{ type: "spring", bounce: 0, duration: 0.5 }}
            >
              <div className="absolute right-2 -top-6 bg-warning text-black text-[10px] font-bold px-2 py-0.5 rounded">
                Threshold: {threshold.toFixed(2)}
              </div>
            </motion.div>
          </div>

        </div>

      </div>
    </div>
  );
}
