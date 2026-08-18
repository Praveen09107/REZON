"use client";
import { useRollingWindow } from "@/hooks/use-rolling-window";
import { ResilienceWrapper } from "@/components/resilience-wrapper";
import { WaveformChart } from "@/components/streams/waveform-chart";

const CHARTS: { key: "audio_score" | "vibration_score" | "env_score" | "gas_score" | "current_score"; label: string; color: string }[] = [
  { key: "audio_score", label: "Audio", color: "#3fb0c9" },
  { key: "vibration_score", label: "Vibration", color: "#a371f7" },
  { key: "env_score", label: "Environment", color: "#6e7681" },
  { key: "gas_score", label: "Gas", color: "#3fb950" },
  { key: "current_score", label: "Current", color: "#d29922" },
];

export default function StreamsPage() {
  const { window, connected, lastUpdateMs } = useRollingWindow(60);

  return (
    <ResilienceWrapper lastUpdateMs={lastUpdateMs} loading={!connected && window.length === 0}>
      <div className="grid grid-cols-2 gap-4">
        {CHARTS.map((chart) => (
          <WaveformChart key={chart.key} data={window} scoreKey={chart.key}
            label={chart.label} colorVar={chart.color} />
        ))}
      </div>
    </ResilienceWrapper>
  );
}
