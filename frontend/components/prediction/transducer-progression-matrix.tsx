"use client";
import { Volume2, Zap, Flame, AlertOctagon, Activity, ArrowUpRight, ArrowRight, ShieldCheck, AlertTriangle } from "lucide-react";

interface TransducerMatrixProps {
  isDegraded: boolean;
  degradationProgress: number; // 0 to 1
  telemetry: any;
}

export function TransducerProgressionMatrix({
  isDegraded,
  degradationProgress,
  telemetry
}: TransducerMatrixProps) {
  const t = telemetry;
  
  // Real or synthesized sensor base values
  const baseAcoustic = (t?.audio_score ?? 0.09) * 60 + 35;
  const baseVib = (t?.vibration_score ?? 0.08) * 4.5 + 0.02;
  const baseTemp = t?.env_temp ?? 22.1;
  const baseGas = (t?.gas_score ?? 0.12) * 350 + 15;
  const baseCurrent = (t?.current_score ?? 0.11) * 8 + 0.5;

  // Modality projections
  const modalities = [
    {
      name: "INMP441 Acoustic Ultrasound",
      tag: "LEADING INDICATOR",
      icon: Volume2,
      color: "text-cyan-400",
      borderColor: "border-cyan-500/30",
      bgGlow: "from-cyan-500/10",
      current: isDegraded ? baseAcoustic + 38 * degradationProgress : baseAcoustic,
      unit: "dB",
      projected1h: isDegraded ? baseAcoustic + 48 * degradationProgress : baseAcoustic + 0.8,
      slope: isDegraded ? `+${(14.8 * degradationProgress).toFixed(1)} dB/h` : "+0.12 dB/h",
      status: isDegraded && degradationProgress > 0.4 ? "ACCELERATING" : "STABLE",
      isSpike: isDegraded && degradationProgress > 0.4
    },
    {
      name: "MPU-6050 Vibration Shock",
      tag: "STRUCTURAL FATIGUE",
      icon: Zap,
      color: "text-purple-400",
      borderColor: "border-purple-500/30",
      bgGlow: "from-purple-500/10",
      current: isDegraded ? baseVib + 3.2 * degradationProgress : baseVib,
      unit: "g",
      projected1h: isDegraded ? baseVib + 3.9 * degradationProgress : baseVib + 0.02,
      slope: isDegraded ? `+${(2.8 * degradationProgress).toFixed(2)} g/h` : "+0.005 g/h",
      status: isDegraded && degradationProgress > 0.5 ? "CRITICAL SPALL" : "STABLE",
      isSpike: isDegraded && degradationProgress > 0.5
    },
    {
      name: "DHT22 / BMP280 Casing Heat",
      tag: "THERMAL DISSIPATION",
      icon: Flame,
      color: "text-amber-400",
      borderColor: "border-amber-500/30",
      bgGlow: "from-amber-500/10",
      current: isDegraded ? baseTemp + 26 * degradationProgress : baseTemp,
      unit: "°C",
      projected1h: isDegraded ? baseTemp + 34 * degradationProgress : baseTemp + 0.4,
      slope: isDegraded ? `+${(12.4 * degradationProgress).toFixed(1)} °C/h` : "+0.18 °C/h",
      status: isDegraded && degradationProgress > 0.6 ? "HEAT RUNAWAY" : "NOMINAL",
      isSpike: isDegraded && degradationProgress > 0.6
    },
    {
      name: "MQ135 Gas / VOC Degassing",
      tag: "INSULATION PYROLYSIS",
      icon: AlertOctagon,
      color: "text-emerald-400",
      borderColor: "border-emerald-500/30",
      bgGlow: "from-emerald-500/10",
      current: isDegraded ? baseGas + 240 * degradationProgress : baseGas,
      unit: "PPM",
      projected1h: isDegraded ? baseGas + 310 * degradationProgress : baseGas + 1.2,
      slope: isDegraded ? `+${(82 * degradationProgress).toFixed(0)} PPM/h` : "+0.8 PPM/h",
      status: isDegraded && degradationProgress > 0.5 ? "OFF-GASSING" : "BASELINE",
      isSpike: isDegraded && degradationProgress > 0.5
    },
    {
      name: "ACS712 Stator Phase Current",
      tag: "ELECTROMAGNETIC",
      icon: Activity,
      color: "text-blue-400",
      borderColor: "border-blue-500/30",
      bgGlow: "from-blue-500/10",
      current: isDegraded ? baseCurrent + 5.8 * degradationProgress : baseCurrent,
      unit: "A",
      projected1h: isDegraded ? baseCurrent + 7.2 * degradationProgress : baseCurrent + 0.1,
      slope: isDegraded ? `+${(2.4 * degradationProgress).toFixed(1)} A/h` : "+0.04 A/h",
      status: isDegraded && degradationProgress > 0.4 ? "EDDY OVERLOAD" : "BALANCED",
      isSpike: isDegraded && degradationProgress > 0.4
    }
  ];

  return (
    <div className="glass rounded-3xl p-6 border border-border/70 space-y-5">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Activity className="w-5 h-5 text-calm" />
          <h3 className="text-lg font-bold text-white uppercase tracking-wider">
            Multi-Modal Prognostic Risk Matrix
          </h3>
        </div>
        <span className="text-xs font-mono text-text-3">
          Transducer Drift Rates &bull; 1-Hour Forward Extrapolation
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        {modalities.map((m, idx) => {
          const Icon = m.icon;
          return (
            <div 
              key={idx}
              className={`bg-[#050505] rounded-2xl p-4 border transition-all duration-500 relative overflow-hidden flex flex-col justify-between ${
                m.isSpike 
                  ? 'border-danger/80 shadow-[0_0_20px_rgba(239,68,68,0.25)] bg-danger/[0.04]' 
                  : 'border-white/5'
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className={`p-2 rounded-xl bg-white/5 ${m.color}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <span className={`text-[9px] font-mono font-bold px-2 py-0.5 rounded-full border ${
                    m.isSpike 
                      ? 'bg-danger/20 border-danger text-danger animate-pulse' 
                      : 'bg-white/5 border-white/10 text-text-3'
                  }`}>
                    {m.status}
                  </span>
                </div>

                <div className="text-[10px] font-mono font-bold uppercase tracking-wider text-text-3 mb-1 truncate">
                  {m.tag}
                </div>
                <h4 className="text-xs font-bold text-white mb-2 leading-snug truncate">
                  {m.name}
                </h4>
              </div>

              <div className="space-y-3 pt-2 border-t border-white/5">
                <div className="flex items-baseline justify-between">
                  <span className="text-[10px] font-mono text-text-3">Current</span>
                  <span className={`text-base font-black font-mono ${m.isSpike ? 'text-danger' : 'text-white'}`}>
                    {m.current.toFixed(m.unit === "g" ? 3 : m.unit === "A" ? 2 : 1)} {m.unit}
                  </span>
                </div>

                <div className="flex items-baseline justify-between bg-white/[0.03] p-1.5 rounded-lg border border-white/5">
                  <span className="text-[9px] font-mono text-text-3 flex items-center gap-1">
                    <ArrowRight className="w-3 h-3 text-calm" /> T+1h Proj:
                  </span>
                  <span className={`text-xs font-bold font-mono ${m.isSpike ? 'text-danger animate-pulse' : 'text-calm'}`}>
                    {m.projected1h.toFixed(m.unit === "g" ? 3 : m.unit === "A" ? 2 : 1)} {m.unit}
                  </span>
                </div>

                <div className="flex items-center justify-between text-[10px] font-mono text-text-3 pt-1">
                  <span>Drift Slope:</span>
                  <span className={`font-bold flex items-center ${m.isSpike ? 'text-danger' : 'text-text-2'}`}>
                    <ArrowUpRight className="w-3 h-3" /> {m.slope}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
