"use client";
import { useLocalSettings } from "@/lib/use-local-settings";

export default function SettingsPage() {
  const { settings, update } = useLocalSettings();

  return (
    <div className="max-w-md space-y-4">
      <div className="rounded-xl border border-border bg-surface p-5">
        <label className="mb-1.5 block text-xs text-text-2">Units</label>
        <select value={settings.units} onChange={(e) => update({ units: e.target.value as "metric" | "imperial" })}
          className="w-full rounded border border-border bg-surface-2 px-3 py-2 text-sm text-text">
          <option value="metric">Metric (°C, hPa)</option>
          <option value="imperial">Imperial (°F, inHg)</option>
        </select>
      </div>
      <p className="text-xs text-text-3">
        Stored on this device only — these are display preferences, not
        synced data, so they don't need account-level storage.
      </p>
    </div>
  );
}
