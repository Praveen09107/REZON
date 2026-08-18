"use client";
import { usePolledQuery } from "@/hooks/use-polled-data";
import { useLiveTelemetry } from "@/hooks/use-live-telemetry";
import { ResilienceWrapper } from "@/components/resilience-wrapper";

interface DeviceRow {
  last_seen_at: string; firmware_version: string; free_heap_bytes: number;
  psram_used_bytes: number; psram_total_bytes: number; wifi_rssi_dbm: number;
  sd_buffer_minutes: number;
}

function formatBytes(bytes: number) { return `${(bytes / 1024).toFixed(0)} KB`; }

export default function DevicePage() {
  const { data, isLoading, dataUpdatedAt } = usePolledQuery<DeviceRow>(["device-health"], "devices", { limit: 1 });
  const { data: telemetry } = useLiveTelemetry();
  const device = data?.[0];

  const secondsSinceSeen = device ? (Date.now() - new Date(device.last_seen_at).getTime()) / 1000 : Infinity;
  const isOnline = secondsSinceSeen < 30;

  return (
    <ResilienceWrapper lastUpdateMs={dataUpdatedAt} loading={isLoading}>
      <div className="grid grid-cols-2 gap-5">
        <div className="rounded-xl border border-border bg-surface p-5">
          <h3 className="mb-3 text-sm font-medium text-text">Device health — REZON-01</h3>
          <div className="space-y-2 text-sm">
            <Row label="Connection" value={isOnline ? "● online" : "○ offline"} valueClass={isOnline ? "text-calm" : "text-danger"} />
            <Row label="Last heartbeat" value={device ? `${Math.floor(secondsSinceSeen)}s ago` : "—"} />
            <Row label="Firmware" value={device?.firmware_version ?? "—"} />
            <Row label="Free heap" value={device ? formatBytes(device.free_heap_bytes) : "—"} />
            <Row label="PSRAM" value={device ? `${formatBytes(device.psram_used_bytes)} / ${formatBytes(device.psram_total_bytes)}` : "—"} />
            <Row label="Wi-Fi RSSI" value={device ? `${device.wifi_rssi_dbm} dBm` : "—"} />
            <Row label="SD buffer" value={device ? `~${device.sd_buffer_minutes} min` : "—"} />
          </div>
        </div>
        <div className="rounded-xl border border-border bg-surface p-5">
          <h3 className="mb-3 text-sm font-medium text-text">Monitored machine</h3>
          <div className="space-y-2 text-sm">
            <Row label="Current draw score" value={telemetry?.current_score?.toFixed(2) ?? "—"} />
            <Row label="Health" value={(telemetry?.current_score ?? 0) < 0.75 ? "nominal" : "elevated"}
              valueClass={(telemetry?.current_score ?? 0) < 0.75 ? "text-calm" : "text-elevated"} />
          </div>
        </div>
      </div>
    </ResilienceWrapper>
  );
}

function Row({ label, value, valueClass }: { label: string; value: string; valueClass?: string }) {
  return (
    <div className="flex justify-between border-b border-border py-1.5 last:border-0">
      <span className="text-text-2">{label}</span>
      <span className={valueClass ?? "text-text"}>{value}</span>
    </div>
  );
}
