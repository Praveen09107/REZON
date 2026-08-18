# SESSION 25 — Settings + Help
**Risk tier: ROUTINE.**
**Branch: `session/build-25-settings-help`**
**Attach: `05_FRONTEND_TECHNICAL_SPEC.md` §7**

---

## Agent Instructions

**A real design decision made here, not just an implementation detail:** Settings (units, timezone, theme) uses browser `localStorage`, not a new Supabase table — deliberately different from Session 24's notification preferences. Reasoning: notification thresholds benefit from following you across devices (a real reason to sync via the database); display preferences like "show Celsius or Fahrenheit" don't carry that same justification for a single-operator capstone system, and adding another table + RLS policy for something this low-stakes would be exactly the kind of unnecessary complexity this project has repeatedly rejected elsewhere (Prefect, a second cloud vendor, etc.). This is the browser-storage exception explicitly allowed for real deployed applications (unlike in-chat artifacts, which have a different, unrelated restriction) — noted here so a future session doesn't mistake this for an oversight.

**What this session creates:**
- `frontend/lib/use-local-settings.ts`
- `frontend/app/settings/page.tsx`
- `frontend/app/help/page.tsx`

---

## FILE 1: `frontend/lib/use-local-settings.ts`

```typescript
"use client";
import { useState, useEffect } from "react";

interface LocalSettings {
  units: "metric" | "imperial";
  theme: "dark" | "light";  // 🟡 "light" is stored but not yet
                              // implemented — the whole design system
                              // (Session 10) is dark-only today; this
                              // is a real future toggle, not fake choice
}

const DEFAULTS: LocalSettings = { units: "metric", theme: "dark" };
const STORAGE_KEY = "rezon-settings";

export function useLocalSettings() {
  const [settings, setSettings] = useState<LocalSettings>(DEFAULTS);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) setSettings(JSON.parse(stored));
  }, []);

  function update(partial: Partial<LocalSettings>) {
    const next = { ...settings, ...partial };
    setSettings(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }

  return { settings, update };
}
```

## FILE 2: `frontend/app/settings/page.tsx`

```typescript
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
```

## FILE 3: `frontend/app/help/page.tsx`

```typescript
// Static content, same pattern as Session 21's Trust Audit — real,
// specific explanation, not generic product-tour copy.
export default function HelpPage() {
  return (
    <div className="max-w-2xl space-y-5 text-sm text-text-2">
      <section>
        <h2 className="mb-2 text-base font-semibold text-text">How REZON works</h2>
        <p>
          REZON watches this space using five independent sensing channels — sound,
          vibration, temperature/humidity/pressure, air quality, and the electrical
          current drawn by the machine it can control. Each channel scores itself
          against its own learned baseline for this specific space; the five scores
          combine into one fused judgment.
        </p>
      </section>
      <section>
        <h2 className="mb-2 text-base font-semibold text-text">Why it can act on its own</h2>
        <p>
          If at least two independent channels agree something is genuinely wrong —
          not just one — and that condition holds steady for several seconds, REZON
          can cut power to the monitored machine automatically. See the{" "}
          <a href="/trust-audit" className="text-calm underline">Trust Audit</a> page
          for the exact real values behind every safety gate.
        </p>
      </section>
      <section>
        <h2 className="mb-2 text-base font-semibold text-text">Why some numbers change over time</h2>
        <p>
          REZON deployed with a model trained on public sound data, then spent its
          first one to two weeks quietly learning this specific room before it was
          trusted to alert or act — see the{" "}
          <a href="/since-calibration" className="text-calm underline">Since Calibration</a> page.
        </p>
      </section>
    </div>
  );
}
```

---

## Verification Steps

**Step 1:** `npm run build` — succeeds.

**Step 2:** Change the units setting, reload the browser (not just the React state) — confirm the choice persists via `localStorage`, genuinely surviving a full page reload.

**Step 3:** Open the app in a different browser (or incognito) — confirm the setting does NOT carry over, the literal proof this is device-local, not account-synced, as designed.

## Known open items
🔴 "Imperial" unit selection is stored but not yet actually applied anywhere (no page currently reads `settings.units` to change its display) — real future wiring, not fabricated as already-functional. "Light" theme is stored but the design system is dark-only today, same honest gap.
