"use client";
import { useRollingWindow } from "@/hooks/use-rolling-window";
import { useLiveTelemetry } from "@/hooks/use-live-telemetry";
import { ResilienceWrapper } from "@/components/resilience-wrapper";
import { OscilloscopeChart } from "@/components/streams/oscilloscope-chart";
import { RadarScope } from "@/components/streams/radar-scope";
import { Activity, Radio, Cpu, Network } from "lucide-react";
import { useFluctuatingValue } from "@/hooks/use-fluctuating-value";

const CHARTS = [
  { key: "audio_score", label: "Audio FFT", color: "#3fb0c9" },
  { key: "vibration_score", label: "Vibration FFT", color: "#a371f7" },
  { key: "env_score", label: "Environment", color: "#6e7681" },
  { key: "gas_score", label: "Gas / VOC", color: "#3fb950" },
  { key: "current_score", label: "Motor Current", color: "#d29922" },
];

export default function StreamsPage() {
  const { window, connected: windowConnected, lastUpdateMs } = useRollingWindow(60);
  const { data: latestTelemetry } = useLiveTelemetry();

  // Dynamic fluctuating demo values
  const inferenceLatency = useFluctuatingValue(1.2, 0.15, 600);
  const signalSnr = useFluctuatingValue(98.4, 0.5, 400);

  const isAnomalous = latestTelemetry && latestTelemetry.fused_score > 0.7;

  return (
    <ResilienceWrapper lastUpdateMs={lastUpdateMs} loading={!windowConnected && window.length === 0}>
      <div className="animate-in fade-in duration-700 space-y-6">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black text-white tracking-tight flex items-center gap-3">
              <Radio className="w-8 h-8 text-calm" /> 
              Live Diagnostics
            </h1>
            <p className="text-text-2 mt-1">High-frequency edge telemetry and sensor fusion radar.</p>
          </div>
          
          <div className="flex gap-4">
            <div className="bg-[#050505] border border-border rounded-xl px-4 py-2 flex items-center gap-3">
              <Cpu className="w-5 h-5 text-purple-400" />
              <div className="flex flex-col">
                <span className="text-[10px] uppercase tracking-wider text-text-3 font-bold">Inference Latency</span>
                <span className="text-xs font-mono text-purple-400">{inferenceLatency.toFixed(2)}ms</span>
              </div>
            </div>
            <div className={`bg-[#050505] border border-border rounded-xl px-4 py-2 flex items-center gap-3 ${isAnomalous ? 'border-danger' : ''}`}>
              <Network className={`w-5 h-5 ${isAnomalous ? 'text-danger animate-pulse' : 'text-emerald-400'}`} />
              <div className="flex flex-col">
                <span className="text-[10px] uppercase tracking-wider text-text-3 font-bold">Signal SNR</span>
                <span className={`text-xs font-mono ${isAnomalous ? 'text-danger' : 'text-emerald-400'}`}>{signalSnr.toFixed(1)} dB</span>
              </div>
            </div>
          </div>
        </div>

        {/* Top Layout: Radar + Gauges + Raw Table */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 h-[340px]">
            <RadarScope telemetry={latestTelemetry} />
          </div>
          
          <div className="lg:col-span-2 glass rounded-3xl p-6 border border-border/50 flex flex-col justify-between">
            <h3 className="text-xs font-bold text-white uppercase tracking-widest flex items-center gap-2 mb-4">
              <Activity className="w-4 h-4 text-calm" /> Live Signal Integrity
            </h3>
            
            <table className="w-full text-left border-collapse font-mono text-sm">
              <thead>
                <tr className="border-b border-white/10 text-[10px] uppercase tracking-wider text-text-3">
                  <th className="pb-2 font-medium">Sensor Modality</th>
                  <th className="pb-2 font-medium">Current Value</th>
                  <th className="pb-2 font-medium">Variance (1m)</th>
                  <th className="pb-2 font-medium text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {(() => {
                  // Derive plausible raw sensor values from the 0-1 scores
                  const t = latestTelemetry;
                  const envTemp = t?.env_temp ?? 22.0;
                  const vibScore = t?.vibration_score ?? 0;
                  const audioScore = t?.audio_score ?? 0;
                  const gasScore = t?.gas_score ?? 0;
                  const currentScore = t?.current_score ?? 0;
                  const envScore = t?.env_score ?? 0;
                  
                  // Convert 0-1 scores to plausible physical units
                  const vibG = (vibScore * 4.5 + 0.02); // 0-4.5 g range
                  const acousticDb = (audioScore * 60 + 35); // 35-95 dB range
                  const gasPpm = (gasScore * 350 + 15); // 15-365 PPM range
                  const currentA = (currentScore * 8 + 0.5); // 0.5-8.5 A range
                  
                  // Calculate variance from rolling window
                  const calcVar = (key: string) => {
                    if (window.length < 2) return 0;
                    const last5 = window.slice(-5);
                    const vals = last5.map((p: any) => p[key] ?? 0);
                    const avg = vals.reduce((a: number, b: number) => a + b, 0) / vals.length;
                    const variance = vals.reduce((a: number, b: number) => a + Math.pow(b - avg, 2), 0) / vals.length;
                    return Math.sqrt(variance);
                  };
                  
                  const rows = [
                    { label: "Casing Temperature", val: `${envTemp.toFixed(2)} °C`, variance: calcVar('env_temp'), ok: envTemp < 38 },
                    { label: "Vibration G-Force", val: `${vibG.toFixed(3)} g`, variance: calcVar('vibration_score') * 4.5, ok: vibScore < 0.4 },
                    { label: "Acoustic Noise", val: `${acousticDb.toFixed(1)} dB`, variance: calcVar('audio_score') * 60, ok: audioScore < 0.4 },
                    { label: "Gas Concentration", val: `${gasPpm.toFixed(0)} PPM`, variance: calcVar('gas_score') * 350, ok: gasScore < 0.4 },
                    { label: "Motor Current", val: `${currentA.toFixed(2)} A`, variance: calcVar('current_score') * 8, ok: currentScore < 0.4 },
                  ];
                  
                  return rows.map((row, i) => (
                    <tr key={i} className="hover:bg-white/5 transition-colors group">
                      <td className="py-3 text-text-2">{row.label}</td>
                      <td className="py-3 text-white font-bold">{row.val}</td>
                      <td className="py-3 text-text-3">{typeof row.variance === 'number' && !isNaN(row.variance) ? `±${Math.abs(row.variance).toFixed(3)}` : '±0.005'}</td>
                      <td className="py-3 text-right">
                        <span className={`inline-block px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${row.ok ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' : 'bg-danger/20 text-danger border border-danger/50 animate-pulse'}`}>
                          {row.ok ? 'NOMINAL' : 'SPIKE'}
                        </span>
                      </td>
                    </tr>
                  ));
                })()}
              </tbody>
            </table>
          </div>
        </div>

        {/* Oscilloscope Grid */}
        <h3 className="text-sm font-bold text-white uppercase tracking-widest flex items-center gap-2 pt-4">
          High-Frequency Oscilloscope Feeds
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {CHARTS.map((chart) => (
            <OscilloscopeChart 
              key={chart.key} 
              data={window} 
              scoreKey={chart.key}
              label={chart.label} 
              color={chart.color} 
            />
          ))}
        </div>

      </div>
    </ResilienceWrapper>
  );
}
