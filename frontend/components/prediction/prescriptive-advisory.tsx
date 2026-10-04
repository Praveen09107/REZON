"use client";
import { Wrench, ShieldAlert, Sparkles, CheckCircle2, Box, Gauge, ArrowRight } from "lucide-react";

interface PrescriptiveAdvisoryProps {
  isDegraded: boolean;
  degradationProgress: number;
  rulHours: number;
}

export function PrescriptiveAdvisory({
  isDegraded,
  degradationProgress,
  rulHours
}: PrescriptiveAdvisoryProps) {
  return (
    <div className={`glass rounded-3xl p-6 border transition-all duration-500 relative overflow-hidden space-y-4 ${
      isDegraded && degradationProgress > 0.4
        ? 'border-amber-500/80 shadow-[0_0_30px_rgba(245,158,11,0.2)] bg-amber-500/[0.03]'
        : 'border-border/70'
    }`}>
      
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className={`w-5 h-5 ${isDegraded ? 'text-amber-400 animate-spin' : 'text-calm'}`} />
          <h3 className="text-base font-bold text-white uppercase tracking-wider">
            Forecaster Prescriptive Actions
          </h3>
        </div>
        <span className={`text-[10px] font-mono font-bold px-2.5 py-1 rounded-full border ${
          isDegraded && degradationProgress > 0.4 
            ? 'bg-danger/20 border-danger text-danger animate-pulse' 
            : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
        }`}>
          {isDegraded && degradationProgress > 0.4 ? "DYNAMIC COUNTERMEASURE ACTIVE" : "CONTINUOUS MONITORING"}
        </span>
      </div>

      <p className="text-xs text-text-3 font-mono">
        Automated operational de-rating and maintenance logistics calculated to prevent forced industrial outage.
      </p>

      {/* Advisory Cards */}
      <div className="space-y-3 pt-1">
        
        {/* Strategy 1: Operational De-rating */}
        <div className="bg-[#050505] p-4 rounded-2xl border border-white/5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-white font-mono flex items-center gap-2">
              <Gauge className="w-4 h-4 text-cyan-400" /> Operational De-rating Strategy
            </span>
            <span className="text-[10px] font-mono text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/20">
              RUL EXTENSION: +350%
            </span>
          </div>
          <p className="text-xs text-text-2 leading-relaxed">
            {isDegraded && degradationProgress > 0.4 ? (
              <span className="text-amber-300 font-medium">
                De-rate motor drive from 2,400 RPM to 1,200 RPM and limit torque to 60%. This reduces centrifugal ball-impact force by 75%, extending RUL from {rulHours.toFixed(1)}h to {(rulHours * 3.5).toFixed(1)}h until the planned shift change.
              </span>
            ) : (
              "Asset operating within nominal speed and torque limits. No speed throttling or load shedding required at this time."
            )}
          </p>
        </div>

        {/* Strategy 2: Spares Verification */}
        <div className="bg-[#050505] p-4 rounded-2xl border border-white/5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-white font-mono flex items-center gap-2">
              <Box className="w-4 h-4 text-purple-400" /> Automated Spares Inventory Audit
            </span>
            <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" /> VERIFIED IN STOCK
            </span>
          </div>
          <div className="flex items-center justify-between text-xs font-mono bg-white/[0.03] p-2 rounded-xl">
            <span className="text-white">SKF 6205-2RSH Deep-Groove Bearing</span>
            <span className="text-purple-300 font-bold">Qty: 4 @ Sector A Bin 14</span>
          </div>
        </div>

        {/* Strategy 3: Prescriptive Work Order */}
        <div className="bg-[#050505] p-4 rounded-2xl border border-white/5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-white font-mono flex items-center gap-2">
              <Wrench className="w-4 h-4 text-amber-400" /> Predictive Work Order Pre-Authorization
            </span>
            <span className="text-[10px] font-mono text-text-3">AUTO-STAGED</span>
          </div>
          <p className="text-xs text-text-2 leading-relaxed">
            {isDegraded ? (
              <span>Pre-authorized Work Order <strong className="text-white">#WO-PRED-4091</strong> drafted for drive-end bearing replacement. Automatically routes to maintenance shift supervisor if RUL breaches 24.0h threshold.</span>
            ) : (
              <span>Standard 1,000h scheduled inspection remains active. Zero premature maintenance dispatch required.</span>
            )}
          </p>
        </div>

      </div>

    </div>
  );
}
