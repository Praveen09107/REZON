"use client";
import { Activity, ShieldAlert, ShieldCheck, Zap, AlertTriangle, Cpu, Radio, Gauge } from "lucide-react";

interface AnomalyTelemetryStripProps {
  telemetry: any;
}

export function AnomalyTelemetryStrip({ telemetry }: AnomalyTelemetryStripProps) {
  const t = telemetry;
  const audioScore = t?.audio_score ?? 0.09;
  const vibScore = t?.vibration_score ?? 0.08;
  const envScore = t?.env_score ?? 0.09;
  const gasScore = t?.gas_score ?? 0.14;
  const currentScore = t?.current_score ?? 0.11;
  const fusedScore = t?.fused_score ?? 0.10;
  const temp = t?.env_temp ?? 22.1;
  const pressure = t?.env_pressure ?? 1012;

  // Derived calibrated physical values
  const acousticDb = audioScore * 60 + 35;
  const vibrationG = vibScore * 4.5 + 0.02;
  const gasPpm = gasScore * 350 + 15;
  const motorAmps = currentScore * 8 + 0.5;

  const isAnomalous = fusedScore > 0.70;
  const isCritical = fusedScore > 0.85;

  // Check 2-of-N corroboration (modalities elevated >= 0.60)
  const sensors = [
    {
      id: "audio",
      name: "INMP441 Acoustic FFT",
      valStr: `${acousticDb.toFixed(1)} dB`,
      score: audioScore,
      weight: 0.35,
      spikeLabel: "Acoustic Resonance / Squeal",
      nominalLabel: "Noise Floor Nominal",
      color: "#06b6d4"
    },
    {
      id: "vib",
      name: "MPU-6050 + SW-420 Vib",
      valStr: `${vibrationG.toFixed(3)} g`,
      score: vibScore,
      weight: 0.25,
      spikeLabel: "BPFO Harmonic Jitter",
      nominalLabel: "3-Axis Vibration Calm",
      color: "#a855f7"
    },
    {
      id: "env",
      name: "DHT22 / BMP280 Thermal",
      valStr: `${temp.toFixed(1)}°C`,
      score: envScore,
      weight: 0.10,
      spikeLabel: "Thermal Gradient Spike",
      nominalLabel: "Operating Temp Stable",
      color: "#eab308"
    },
    {
      id: "gas",
      name: "MQ135 Gas / Air Quality",
      valStr: `${gasPpm.toFixed(0)} PPM`,
      score: gasScore,
      weight: 0.10,
      spikeLabel: "VOC / Burnoff Elevated",
      nominalLabel: "Clean Atmosphere",
      color: "#10b981"
    },
    {
      id: "current",
      name: "ACS712 Motor Current",
      valStr: `${motorAmps.toFixed(2)} A`,
      score: currentScore,
      weight: 0.20,
      spikeLabel: "Inrush / Rotor Overload",
      nominalLabel: "Current Draw Normal",
      color: "#f97316"
    },
  ];

  const elevatedCount = sensors.filter(s => s.score >= 0.60).length;
  const corroborationMet = elevatedCount >= 2;

  return (
    <div className={`glass rounded-3xl p-6 border transition-all duration-500 overflow-hidden relative ${
      isCritical ? 'border-danger/80 shadow-[0_0_30px_rgba(239,68,68,0.2)]' :
      isAnomalous ? 'border-warning/70 shadow-[0_0_25px_rgba(245,158,11,0.15)]' :
      'border-border/50'
    }`}>
      {/* Dynamic top bar alert */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 pb-4 border-b border-border/40">
        <div>
          <div className="flex items-center gap-2 mb-1">
            {isCritical ? (
              <ShieldAlert className="w-5 h-5 text-danger animate-pulse" />
            ) : isAnomalous ? (
              <AlertTriangle className="w-5 h-5 text-warning animate-pulse" />
            ) : (
              <ShieldCheck className="w-5 h-5 text-emerald-400" />
            )}
            <h2 className="text-base font-bold text-white uppercase tracking-wider">
              Cross-Modal Physical Anomaly Telemetry
            </h2>
          </div>
          <p className="text-xs text-text-3 font-mono">
            Real-time transducer vectors feeding 2-of-N hardware consensus interlock
          </p>
        </div>

        {/* Status Pill */}
        <div className="flex items-center gap-3">
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-mono font-bold uppercase tracking-wider ${
            isCritical ? 'bg-danger/20 border-danger text-danger animate-pulse shadow-[0_0_15px_rgba(239,68,68,0.4)]' :
            isAnomalous ? 'bg-warning/20 border-warning text-warning' :
            'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
          }`}>
            <span className={`w-2 h-2 rounded-full ${
              isCritical ? 'bg-danger animate-ping' : isAnomalous ? 'bg-warning' : 'bg-emerald-400'
            }`} />
            {isCritical ? "CRITICAL: 2-OF-N ACTUATION IMMINENT" :
             isAnomalous ? "ALERT: ANOMALY CORROBORATION UNDERWAY" :
             "ALL 5 SENSORS NOMINAL"}
          </div>
        </div>
      </div>

      {/* 5 Transducer Vector Strip Grid */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-3 mb-6">
        {sensors.map((s) => {
          const isElevated = s.score >= 0.60;
          return (
            <div 
              key={s.id}
              className={`p-3.5 rounded-2xl border transition-all ${
                isElevated 
                  ? 'bg-danger/10 border-danger/50 shadow-[0_0_15px_rgba(239,68,68,0.15)]' 
                  : 'bg-surface-2/70 border-border/60 hover:border-calm/30'
              }`}
            >
              <div className="flex justify-between items-start mb-2">
                <span className="text-[10px] uppercase font-bold tracking-wider text-text-3 truncate max-w-[100px]">
                  {s.name.split(' ')[0]}
                </span>
                <span className={`text-[9px] font-bold font-mono px-1.5 py-0.2 rounded border ${
                  isElevated ? 'bg-danger/20 text-danger border-danger/40 animate-pulse' : 'bg-surface-3 text-text-3 border-border'
                }`}>
                  w={s.weight}
                </span>
              </div>

              <div className="text-xl font-black font-mono text-white mb-1">
                {s.valStr}
              </div>

              <div className="text-[10px] font-medium text-text-3 mb-2 truncate">
                {isElevated ? (
                  <span className="text-danger font-bold">{s.spikeLabel}</span>
                ) : (
                  <span>{s.nominalLabel}</span>
                )}
              </div>

              {/* Progress bar */}
              <div className="w-full h-1.5 bg-surface-3 rounded-full overflow-hidden">
                <div 
                  className={`h-full transition-all duration-300 ${
                    isElevated ? 'bg-danger shadow-[0_0_10px_rgba(239,68,68,0.8)]' : 'bg-calm'
                  }`}
                  style={{ width: `${Math.min(100, Math.max(8, s.score * 100))}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Mathematical 2-of-N Equation & Consensus Bar */}
      <div className="bg-[#050505] p-4 rounded-2xl border border-border/60 flex flex-col lg:flex-row items-center justify-between gap-4 font-mono text-xs">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex items-center gap-2">
            <Cpu className="w-4 h-4 text-purple-400 shrink-0" />
            <span className="text-text-3 text-[11px] uppercase font-bold tracking-wider">
              Fusion Formula:
            </span>
          </div>
          <div className="text-text-2 text-[11px] bg-surface-2 px-3 py-1.5 rounded-lg border border-border/40">
            Fused = (0.35·<span className={audioScore > 0.6 ? 'text-danger font-bold' : 'text-white'}>{audioScore.toFixed(2)}</span>) + 
            (0.25·<span className={vibScore > 0.6 ? 'text-danger font-bold' : 'text-white'}>{vibScore.toFixed(2)}</span>) + 
            (0.10·<span className={envScore > 0.6 ? 'text-danger font-bold' : 'text-white'}>{envScore.toFixed(2)}</span>) + 
            (0.10·<span className={gasScore > 0.6 ? 'text-danger font-bold' : 'text-white'}>{gasScore.toFixed(2)}</span>) + 
            (0.20·<span className={currentScore > 0.6 ? 'text-danger font-bold' : 'text-white'}>{currentScore.toFixed(2)}</span>) = 
            <span className={`font-bold ml-1.5 text-sm ${isCritical ? 'text-danger' : isAnomalous ? 'text-warning' : 'text-emerald-400'}`}>
              {fusedScore.toFixed(3)}
            </span>
          </div>
        </div>

        {/* 2-of-N Corroboration Badge */}
        <div className="flex items-center gap-3 shrink-0">
          <span className="text-[11px] text-text-3 font-bold uppercase tracking-wider">
            Corroboration:
          </span>
          <span className={`px-2.5 py-1 rounded-lg font-bold text-xs border ${
            corroborationMet 
              ? 'bg-danger/20 text-danger border-danger/40 animate-pulse' 
              : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
          }`}>
            {elevatedCount} of 5 Channels ({corroborationMet ? "CRITICAL 2-OF-N MET" : "1-OF-N IMMUNE"})
          </span>
        </div>
      </div>
    </div>
  );
}
