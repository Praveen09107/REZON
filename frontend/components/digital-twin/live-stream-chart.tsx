"use client";
import { useEffect, useState } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";
import type { TelemetryRow } from "@/lib/api-client";

export function LiveStreamChart({ currentData }: { currentData: TelemetryRow | null }) {
  const [history, setHistory] = useState<any[]>([]);

  useEffect(() => {
    if (currentData) {
      setHistory(prev => {
        // Keep last 30 seconds of data for smooth scrolling
        const newHistory = [...prev, {
          time: new Date(currentData.recorded_at).toLocaleTimeString([], { second: '2-digit', minute: '2-digit' }),
          fused: currentData.fused_score,
          audio: currentData.audio_score,
          vib: currentData.vibration_score
        }];
        if (newHistory.length > 30) newHistory.shift();
        return newHistory;
      });
    }
  }, [currentData]);

  if (history.length === 0) return <div className="h-[250px] w-full flex items-center justify-center text-text-3">Awaiting stream...</div>;

  return (
    <div className="h-[250px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={history} margin={{ top: 5, right: 0, left: -20, bottom: 0 }}>
          <XAxis dataKey="time" stroke="var(--text-3)" fontSize={12} tickMargin={10} minTickGap={30} />
          <YAxis domain={[0, 1]} stroke="var(--text-3)" fontSize={12} tickCount={5} />
          <Tooltip 
            contentStyle={{ backgroundColor: 'var(--surface-2)', borderColor: 'var(--border)', borderRadius: '8px' }}
            itemStyle={{ color: 'var(--text)' }}
          />
          <ReferenceLine y={0.85} stroke="var(--danger)" strokeDasharray="3 3" label={{ position: 'top', value: 'Actuation', fill: 'var(--danger)', fontSize: 10 }} />
          <ReferenceLine y={0.65} stroke="var(--elevated)" strokeDasharray="3 3" label={{ position: 'insideBottomRight', value: 'Alert', fill: 'var(--elevated)', fontSize: 10 }} />
          
          <Line type="monotone" dataKey="audio" stroke="#8b5cf6" strokeWidth={2} dot={false} isAnimationActive={false} opacity={0.5} />
          <Line type="monotone" dataKey="vib" stroke="#10b981" strokeWidth={2} dot={false} isAnimationActive={false} opacity={0.5} />
          <Line type="monotone" dataKey="fused" stroke="var(--calm)" strokeWidth={4} dot={false} isAnimationActive={false} 
                style={{ filter: "drop-shadow(0px 0px 8px rgba(6,182,212,0.6))" }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
