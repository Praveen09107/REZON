import { useEffect, useState } from "react";
import { Radar } from "lucide-react";

interface RadarScopeProps {
  telemetry: any;
}

export function RadarScope({ telemetry }: RadarScopeProps) {
  // We expect scores between 0 and 1
  const audio = telemetry?.audio_score ?? 0.1;
  const vib = telemetry?.vibration_score ?? 0.1;
  const env = telemetry?.env_score ?? 0.1;
  const gas = telemetry?.gas_score ?? 0.1;
  const current = telemetry?.current_score ?? 0.1;

  const size = 300;
  const center = size / 2;
  const radius = size * 0.4;
  
  // Calculate pentagon points based on values
  const getPoint = (value: number, angleIndex: number, total: number) => {
    const angle = (Math.PI * 2 * angleIndex) / total - Math.PI / 2;
    // Map value (0-1) to radius
    const r = radius * (0.2 + value * 0.8); // Min 20% size so it doesn't collapse
    const x = center + r * Math.cos(angle);
    const y = center + r * Math.sin(angle);
    return `${x},${y}`;
  };

  const points = [
    getPoint(audio, 0, 5),
    getPoint(vib, 1, 5),
    getPoint(env, 2, 5),
    getPoint(gas, 3, 5),
    getPoint(current, 4, 5),
  ].join(" ");
  
  // Background grid points
  const getGridPoints = (scale: number) => {
    return Array.from({ length: 5 }).map((_, i) => getPoint(scale, i, 5)).join(" ");
  };

  const isAnomalous = telemetry && telemetry.fused_score > 0.7;

  return (
    <div className="w-full h-full bg-[#050505] rounded-3xl border border-border/50 relative overflow-hidden flex flex-col items-center justify-center p-4">
      
      <div className="absolute top-4 left-4 z-10">
        <h3 className="text-xs font-bold text-white uppercase tracking-widest flex items-center gap-2">
          <Radar className="w-4 h-4 text-calm" /> Fusion Radar
        </h3>
      </div>
      
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="w-full max-w-[280px] h-auto overflow-visible">
        <defs>
          <filter id="radarGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="5" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* Radar Rings (Grid) */}
        {[0, 0.25, 0.5, 0.75, 1].map((scale, i) => (
          <polygon 
            key={i} 
            points={getGridPoints(scale)} 
            fill="none" 
            stroke="rgba(255,255,255,0.1)" 
            strokeWidth="1" 
          />
        ))}

        {/* Axis Lines */}
        {Array.from({ length: 5 }).map((_, i) => {
          const pt = getPoint(1, i, 5).split(",");
          return (
            <line 
              key={i} 
              x1={center} y1={center} 
              x2={pt[0]} y2={pt[1]} 
              stroke="rgba(255,255,255,0.1)" strokeWidth="1" 
            />
          );
        })}

        {/* Labels */}
        <text x={center} y={center - radius - 15} textAnchor="middle" fill="#3fb0c9" fontSize="10" className="font-mono">AUDIO</text>
        <text x={center + radius + 25} y={center - radius*0.2} textAnchor="middle" fill="#a371f7" fontSize="10" className="font-mono">VIBRATION</text>
        <text x={center + radius*0.6} y={center + radius + 15} textAnchor="middle" fill="#6e7681" fontSize="10" className="font-mono">ENV</text>
        <text x={center - radius*0.6} y={center + radius + 15} textAnchor="middle" fill="#3fb950" fontSize="10" className="font-mono">GAS</text>
        <text x={center - radius - 20} y={center - radius*0.2} textAnchor="middle" fill="#d29922" fontSize="10" className="font-mono">CURRENT</text>

        {/* Data Shape */}
        <polygon 
          points={points} 
          fill={isAnomalous ? "rgba(239, 68, 68, 0.2)" : "rgba(6, 182, 212, 0.2)"} 
          stroke={isAnomalous ? "#ef4444" : "#06b6d4"} 
          strokeWidth="3"
          filter="url(#radarGlow)"
          className="transition-all duration-300"
        />
        
        {/* Center dot */}
        <circle cx={center} cy={center} r="3" fill="#fff" />
      </svg>
      
      {/* Background sweep animation (pure CSS) */}
      <div className="absolute inset-0 pointer-events-none opacity-20">
        <div className="absolute top-1/2 left-1/2 w-[300px] h-[300px] -mt-[150px] -ml-[150px] rounded-full border border-calm/30 animate-[spin_4s_linear_infinite]" 
             style={{ background: 'conic-gradient(from 0deg, transparent 0deg, transparent 270deg, rgba(6,182,212,0.5) 360deg)' }} />
      </div>
    </div>
  );
}
