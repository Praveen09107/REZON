"use client";
import { scoreToColorToken } from "@/lib/score-color";
import type { TelemetryRow } from "@/lib/api-client";

interface SensorNode {
  key: keyof Pick<TelemetryRow, "audio_score" | "vibration_score" | "env_score" | "gas_score" | "current_score">;
  label: string;
  position: { top?: string; left?: string; right?: string; bottom?: string };
}

// Map the 5 sensors to physical parts of the virtual motor/HVAC unit
const SENSOR_NODES: SensorNode[] = [
  { key: "vibration_score", label: "Bearing Vib", position: { top: "25%", left: "30%" } },
  { key: "audio_score", label: "Acoustic IDNN", position: { top: "15%", right: "20%" } },
  { key: "current_score", label: "Power Draw", position: { bottom: "35%", right: "15%" } },
  { key: "env_score", label: "Motor Temp", position: { bottom: "40%", left: "20%" } },
  { key: "gas_score", label: "Exhaust VOC", position: { top: "45%", left: "45%" } },
];

function pulseSpeedForScore(score: number): string {
  // 0.0 = 3s, 1.0 = 0.3s
  const durationSec = Math.max(0.3, 3.0 - score * 2.7);
  return `${durationSec}s`;
}

export function RoomVisualization({ telemetry }: { telemetry: TelemetryRow | null }) {
  // Calculate an overall intensity for the machine's body glow
  const maxScore = telemetry 
    ? Math.max(telemetry.audio_score, telemetry.vibration_score, telemetry.env_score, telemetry.gas_score, telemetry.current_score)
    : 0;
  
  const bodyGlowColor = maxScore > 0.85 ? "rgba(239, 68, 68, 0.4)" // danger
                      : maxScore > 0.65 ? "rgba(245, 158, 11, 0.4)" // elevated
                      : "rgba(6, 182, 212, 0.1)"; // calm

  return (
    <div className="relative flex h-[480px] items-center justify-center rounded-2xl border border-border bg-surface p-10 overflow-hidden">
      
      {/* Background ambient pulse based on fused score */}
      {telemetry && telemetry.fused_score > 0.65 && (
        <div 
          className="absolute inset-0 z-0 bg-danger opacity-10 animate-pulse" 
          style={{ animationDuration: '1s' }}
        />
      )}

      <div className="relative h-[380px] w-[380px] z-10 flex items-center justify-center">
        
        {/* The Digital Twin (Abstract Machine SVG) */}
        <div className="absolute transition-all duration-1000 ease-in-out" style={{ filter: `drop-shadow(0 0 40px ${bodyGlowColor})` }}>
          <svg width="280" height="280" viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="30" y="40" width="140" height="120" rx="12" fill="var(--surface-2)" stroke="var(--border)" strokeWidth="3"/>
            <circle cx="100" cy="100" r="40" fill="var(--bg)" stroke="var(--border)" strokeWidth="2"/>
            {/* Spinning rotor when motor is ON (assuming fused < actuation threshold) */}
            <g className={(telemetry && telemetry.fused_score > 0.85) ? "" : "animate-spin"} style={{ transformOrigin: "100px 100px", animationDuration: "2s" }}>
              <path d="M100 65 L115 100 L100 135 L85 100 Z" fill="var(--text-3)"/>
              <path d="M65 100 L100 115 L135 100 L100 85 Z" fill="var(--text-3)"/>
            </g>
            <path d="M40 50 L160 50" stroke="var(--border)" strokeWidth="2" strokeDasharray="4 4"/>
            <path d="M40 150 L160 150" stroke="var(--border)" strokeWidth="2" strokeDasharray="4 4"/>
            
            <rect x="45" y="10" width="110" height="30" rx="4" fill="var(--surface-2)" stroke="var(--border)" strokeWidth="2"/>
            <rect x="70" y="160" width="60" height="20" rx="4" fill="var(--surface-2)" stroke="var(--border)" strokeWidth="2"/>
          </svg>
        </div>

        {/* Dynamic Sensor Nodes */}
        {SENSOR_NODES.map((node) => {
          const score = telemetry?.[node.key] ?? 0;
          const token = scoreToColorToken(score);
          return (
            <div key={node.key} className="absolute z-20" style={node.position}>
              <div
                className={`relative h-4 w-4 rounded-full bg-${token}`}
                style={{ animationDuration: pulseSpeedForScore(score), boxShadow: `0 0 15px var(--${token})` }}
              >
                <div
                  className={`absolute -inset-2 animate-ping rounded-full bg-${token} opacity-40`}
                  style={{ animationDuration: pulseSpeedForScore(score) }}
                />
              </div>
              <div className="mt-2 whitespace-nowrap rounded-md border border-border bg-surface px-2 py-1 text-[10.5px] font-bold text-text backdrop-blur-md">
                {node.label}: {(score * 100).toFixed(0)}%
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
