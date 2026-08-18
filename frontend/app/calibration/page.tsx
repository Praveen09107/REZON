"use client";
import { useStaticQuery } from "@/hooks/use-static-data";
import { ResilienceWrapper } from "@/components/resilience-wrapper";
import { useIsOperator } from "@/lib/auth-context";

// Sensor list matches ADD's real 5 modalities + SW-420 exactly —
// re-checked against CLAUDE.md's architecture-facts list, not assumed.
const SENSORS = [
  { name: "INMP441", modality: "Audio", baseline: "learned (IDNN)" },
  { name: "MPU-6050 + SW-420", modality: "Vibration", baseline: "3-band, self-calibrating" },
  { name: "DHT22 + BMP280", modality: "Environment", baseline: "self-calibrating" },
  { name: "MQ135", modality: "Gas", baseline: "temp/humidity-compensated" },
  { name: "ACS712", modality: "Current", baseline: "filtered, self-calibrating" },
];

export default function CalibrationPage() {
  const isOperator = useIsOperator();
  // 🔴 OPEN ITEM: real per-sensor calibration STATUS (calibrated vs
  // not) has no backing data source yet — same class of gap as
  // DEC-041/046, honestly flagged rather than fabricated as "all
  // green" placeholder data. This page currently shows the static
  // sensor list only; live status is a real future addition needing
  // its own schema decision.
  return (
    <ResilienceWrapper lastUpdateMs={Date.now()} loading={false}>
      <div className="rounded-xl border border-border bg-surface p-4">
        <div className="mb-3 rounded-md border border-elevated bg-elevated-bg px-3 py-2 text-xs text-elevated">
          Live per-sensor calibration status is not yet wired to a data source — showing the static sensor list only.
        </div>
        {SENSORS.map((s) => (
          <div key={s.name} className="flex items-center justify-between border-b border-border py-2.5 last:border-0">
            <div>
              <div className="text-sm text-text">{s.name}</div>
              <div className="text-xs text-text-3">{s.modality} · {s.baseline}</div>
            </div>
            {isOperator && <button className="rounded bg-surface-2 px-2.5 py-1 text-xs text-text-2">Recalibrate</button>}
          </div>
        ))}
      </div>
    </ResilienceWrapper>
  );
}
