"use client";
import { Radio, Zap } from "lucide-react";

interface SpectralProjectionProps {
  isDegraded: boolean;
  degradationProgress: number;
}

export function SpectralProjection({ isDegraded, degradationProgress }: SpectralProjectionProps) {
  // Harmonic peaks: 1X (40Hz / 2400 RPM), 2X (80Hz), 3X (120Hz), BPFO (168Hz), High-Freq (2400Hz)
  const harmonics = [
    { freq: "40 Hz (1X)", label: "Fundamental RPM", baseAmp: 0.65, degradedAmp: 0.72 },
    { freq: "80 Hz (2X)", label: "Shaft Misalignment", baseAmp: 0.22, degradedAmp: 0.45 },
    { freq: "120 Hz (3X)", label: "Phase Modulation", baseAmp: 0.15, degradedAmp: 0.38 },
    { freq: "168 Hz (BPFO)", label: "Outer Raceway Impact", baseAmp: 0.08, degradedAmp: 0.94 },
    { freq: "2.4 kHz", label: "Harmonic Sidebands", baseAmp: 0.05, degradedAmp: 0.88 },
    { freq: "4.8 kHz", label: "Micro-Fissure Resonance", baseAmp: 0.04, degradedAmp: 0.76 },
  ];

  return (
    <div className="glass rounded-3xl p-6 border border-border/70 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Radio className="w-5 h-5 text-calm" />
          <h3 className="text-base font-bold text-white uppercase tracking-wider">
            Harmonic Spectral Growth Projection
          </h3>
        </div>
        <span className="text-[10px] font-mono text-text-3">FFT Projected Spectrum (T+1h)</span>
      </div>

      <p className="text-xs text-text-3 font-mono">
        Fourier decomposition reveals non-linear growth in high-frequency sidebands (2.4kHz) prior to physical macroscopic shudder.
      </p>

      <div className="space-y-3 pt-2">
        {harmonics.map((h, i) => {
          const currentAmp = isDegraded 
            ? h.baseAmp + (h.degradedAmp - h.baseAmp) * degradationProgress 
            : h.baseAmp;
          const isCriticalPeak = isDegraded && currentAmp > 0.6 && (h.freq.includes("BPFO") || h.freq.includes("2.4 kHz"));

          return (
            <div key={i} className="bg-[#050505] p-3 rounded-xl border border-white/5 space-y-1.5">
              <div className="flex justify-between items-center text-xs font-mono">
                <span className="text-white font-bold">{h.freq}</span>
                <span className="text-text-3 text-[11px]">{h.label}</span>
                <span className={`font-bold ${isCriticalPeak ? 'text-danger animate-pulse' : 'text-calm'}`}>
                  {(currentAmp * 100).toFixed(1)}% Amp
                </span>
              </div>
              
              <div className="w-full bg-white/5 h-2 rounded-full overflow-hidden flex">
                <div 
                  className={`h-full transition-all duration-500 rounded-full ${
                    isCriticalPeak 
                      ? 'bg-gradient-to-r from-amber-500 to-danger shadow-[0_0_10px_rgba(239,68,68,0.5)]' 
                      : 'bg-cyan-500'
                  }`}
                  style={{ width: `${Math.min(100, currentAmp * 100)}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
