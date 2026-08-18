# SESSION 22 — Device & Machine + Sensor Calibration
**Risk tier: ROUTINE.**
**Branch: `session/build-22-device-calibration`**
**Attach: `05_FRONTEND_TECHNICAL_SPEC.md` §7, `03_BACKEND_CLOUD_TECHNICAL_SPEC.md` §1 (as retrofitted, `DEC-046`), Session 08 (as actually built)**

---

## Agent Instructions

**This session includes a firmware retrofit first**, closing `DEC-046`'s gap — Session 8's networking task never actually read or sent device health metadata, so the page this session builds would otherwise have real columns and no real data. Firmware retrofit, then the two frontend pages.

**What this session creates/modifies:**
- `main/networking_task.c` — RETROFIT: populate and send device health fields
- `frontend/app/device/page.tsx`
- `frontend/app/calibration/page.tsx`

---

## FILE 1: `main/networking_task.c` — RETROFIT (closes DEC-046)

```c
// ADDED to submit_telemetry()'s JSON body construction, before the
// existing fields:
#include "esp_heap_caps.h"
#include "esp_wifi.h"

cJSON_AddNumberToObject(root, "free_heap_bytes", esp_get_free_heap_size());
cJSON_AddNumberToObject(root, "psram_used_bytes",
    heap_caps_get_total_size(MALLOC_CAP_SPIRAM) - heap_caps_get_free_size(MALLOC_CAP_SPIRAM));
cJSON_AddNumberToObject(root, "psram_total_bytes", heap_caps_get_total_size(MALLOC_CAP_SPIRAM));

wifi_ap_record_t ap_info;
int rssi = esp_wifi_sta_get_ap_info(&ap_info) == ESP_OK ? ap_info.rssi : 0;
cJSON_AddNumberToObject(root, "wifi_rssi_dbm", rssi);

// 🟡 SD buffer minutes: real implementation needs to check the actual
// SD card's buffered-file size and divide by known bytes-per-minute
// of telemetry — this requires the SD buffering logic itself (Session
// 3's mention, never fully implemented as its own subsystem across
// any prior session). Sending 0 honestly here rather than a fabricated
// estimate; flagged as a real open item below, not silently faked.
cJSON_AddNumberToObject(root, "sd_buffer_minutes", 0);
```

## FILE 2: `frontend/app/device/page.tsx`

```typescript
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
```

## FILE 3: `frontend/app/calibration/page.tsx`

```typescript
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
```

---

## Verification Steps

**Step 1:** `npm run build` (frontend) and `idf.py build` (firmware) — both succeed.

**Step 2 (real hardware, HW_VERIFICATION_LOG.md entry required):** flash the retrofitted firmware, confirm real `free_heap_bytes`/`psram_used_bytes`/`wifi_rssi_dbm` values appear in the Supabase `devices` row — not zero, not placeholder, actual numbers that change plausibly between readings.

**Step 3:** Confirm the Device page's "online/offline" status genuinely flips based on `last_seen_at` — stop the device, wait 30+ seconds, confirm the page shows offline without a manual refresh.

## Known open items — named honestly, not smoothed over
🔴 `sd_buffer_minutes` is sent as a hardcoded 0 — the actual SD buffering subsystem was never fully implemented as its own component across any prior firmware session (only referenced as a role for the SD card, ADD §7.5). Real implementation is a genuine future task, not something to fake a plausible-looking number for here.
🔴 Sensor Calibration page has no live status data source yet — flagged directly in the UI itself, not hidden.
