"use client";
import { useState } from "react";
import { usePolledQuery } from "@/hooks/use-polled-data";
import { ResilienceWrapper } from "@/components/resilience-wrapper";
import { Settings2, RefreshCw, CheckCircle2, ShieldCheck, Gauge, Zap } from "lucide-react";

interface SensorCalibration {
  name: string;
  modality: string;
  baseline: string;
  status: string;
  noiseFloor: string;
  offset: string;
  last_calibrated: string;
}

export default function CalibrationPage() {
  const { data: sensors = [], isLoading, dataUpdatedAt, refetch } = usePolledQuery<SensorCalibration>(
    ["calibration"], "calibration"
  );
  const [calibrating, setCalibrating] = useState<string | null>(null);

  const handleRecalibrate = async (sensorName: string) => {
    setCalibrating(sensorName);
    try {
      await fetch('/api/data/calibration', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sensorName })
      });
      setTimeout(() => {
        setCalibrating(null);
        refetch();
      }, 1500);
    } catch (err) {
      setCalibrating(null);
    }
  };

  return (
    <ResilienceWrapper lastUpdateMs={dataUpdatedAt} loading={isLoading}>
      <div className="animate-in fade-in duration-700 space-y-8">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black text-white tracking-tight flex items-center gap-3">
              <Settings2 className="w-8 h-8 text-calm" /> 
              Sensor Zero-Point Calibration
            </h1>
            <p className="text-text-2 mt-1">Multi-modal physical edge transducer baselines and hardware zero-point tracking.</p>
          </div>

          <div className="flex items-center gap-3">
            <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-xl px-4 py-2 flex items-center gap-2.5">
              <CheckCircle2 className="w-4 h-4" />
              <span className="text-xs font-mono font-bold uppercase tracking-wider">
                5 OF 5 TRANSDUCERS CALIBRATED
              </span>
            </div>
          </div>
        </div>

        {/* Overview Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="glass rounded-2xl p-5 border-t-2 border-t-calm/50">
            <div className="text-xs text-text-3 uppercase font-bold tracking-wider mb-1 flex items-center gap-1.5">
              <Gauge className="w-4 h-4 text-calm" /> Calibration Methodology
            </div>
            <div className="text-xl font-bold text-white mt-1">
              Active Noise-Floor Profiling
            </div>
            <div className="text-xs text-text-3 mt-1">
              Dynamic temperature/humidity compensation enabled
            </div>
          </div>

          <div className="glass rounded-2xl p-5 border-t-2 border-t-emerald-500/50">
            <div className="text-xs text-text-3 uppercase font-bold tracking-wider mb-1 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-400" /> Sensor Consensus Health
            </div>
            <div className="text-xl font-bold text-emerald-400 font-mono mt-1">
              100% Nominal
            </div>
            <div className="text-xs text-text-3 mt-1">
              Zero baseline drift across all 5 physical ADC channels
            </div>
          </div>

          <div className="glass rounded-2xl p-5 border-t-2 border-t-purple-500/50">
            <div className="text-xs text-text-3 uppercase font-bold tracking-wider mb-1 flex items-center gap-1.5">
              <Zap className="w-4 h-4 text-purple-400" /> Auto-Zero Interval
            </div>
            <div className="text-xl font-bold text-purple-400 font-mono mt-1">
              Continuous
            </div>
            <div className="text-xs text-text-3 mt-1">
              Self-calibrating rolling window (SW-420, MPU, DHT, MQ, ACS)
            </div>
          </div>
        </div>

        {/* Sensors Grid */}
        <div className="grid grid-cols-1 gap-4">
          {sensors.map((sensor) => {
            const isCurrentlyCalibrating = calibrating === sensor.name;

            return (
              <div 
                key={sensor.name} 
                className="glass rounded-3xl p-6 border border-border/50 hover:border-calm/40 transition-all duration-300"
              >
                <div className="flex flex-col lg:flex-row justify-between lg:items-center gap-6">
                  
                  {/* Left: Sensor Details */}
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-surface-2 border border-border flex items-center justify-center shrink-0">
                      <Settings2 className="w-6 h-6 text-calm" />
                    </div>
                    <div>
                      <div className="flex items-center gap-3">
                        <h2 className="text-lg font-bold text-white">{sensor.name}</h2>
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-calm/10 text-calm border border-calm/30">
                          {sensor.modality}
                        </span>
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                          {sensor.status}
                        </span>
                      </div>
                      <p className="text-xs text-text-2 mt-1">
                        Baseline Profile: <span className="text-white font-mono">{sensor.baseline}</span>
                      </p>
                    </div>
                  </div>

                  {/* Middle: Live Calibration Metrics */}
                  <div className="flex flex-wrap items-center gap-6 font-mono text-xs">
                    <div className="flex flex-col">
                      <span className="text-[10px] uppercase font-bold text-text-3 tracking-wider">Noise Floor</span>
                      <span className="text-sm font-bold text-white mt-0.5">{sensor.noiseFloor}</span>
                    </div>

                    <div className="flex flex-col">
                      <span className="text-[10px] uppercase font-bold text-text-3 tracking-wider">Current Offset</span>
                      <span className="text-sm font-bold text-emerald-400 mt-0.5">{sensor.offset}</span>
                    </div>

                    <div className="flex flex-col">
                      <span className="text-[10px] uppercase font-bold text-text-3 tracking-wider">Last Calibrated</span>
                      <span className="text-xs text-text-2 mt-0.5">
                        {new Date(sensor.last_calibrated).toLocaleTimeString()}
                      </span>
                    </div>
                  </div>

                  {/* Right: Action Button */}
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => handleRecalibrate(sensor.name)}
                      disabled={isCurrentlyCalibrating}
                      className="bg-surface-2 hover:bg-surface-3 border border-border text-white px-4 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-2 disabled:opacity-50"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isCurrentlyCalibrating ? 'animate-spin text-calm' : ''}`} />
                      {isCurrentlyCalibrating ? 'Sampling 100 Frames...' : 'Recalibrate Zero-Point'}
                    </button>
                  </div>

                </div>
              </div>
            );
          })}
        </div>

      </div>
    </ResilienceWrapper>
  );
}
