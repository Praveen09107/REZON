# SESSION 21 — Trust Audit
**Risk tier: ROUTINE (static content, no data layer at all — per Frontend Spec §7's explicit design: "documentation-as-product-feature, not a dashboard").**
**Branch: `session/build-21-trust-audit`**
**Attach: `05_FRONTEND_TECHNICAL_SPEC.md` §7, `02_FIRMWARE_RTOS_TECHNICAL_SPEC.md` §5-7, `01_AI_ML_TECHNICAL_SPEC.md` §7.4**

---

## Agent Instructions

Build a real, specific, versioned content page — not generic "we take safety seriously" copy, but the actual mechanisms with their actual values, each traceable to the real spec section and Decisions Log entry that established it. This page exists specifically to make `HANDBOOK_05_DEMO_DAY_RUNBOOK.md`'s "show the Trust Audit page" step genuinely substantive.

**What this session creates:**
- `frontend/lib/trust-audit-content.ts` — the real content, as structured data (not hardcoded JSX, so it stays a single source of truth if a value ever changes)
- `frontend/app/trust-audit/page.tsx`

---

## FILE 1: `frontend/lib/trust-audit-content.ts`

```typescript
export interface SafetyMechanism {
  name: string;
  description: string;
  realValue: string;
  specReference: string;
  decisionReference?: string;
}

// Real values, checked against the live specs while writing this file —
// not a paraphrase written from memory. If any of these ever change,
// this is the one file to update; the page itself never hardcodes values.
export const SAFETY_MECHANISMS: SafetyMechanism[] = [
  {
    name: "Multi-modality corroboration",
    description: "The relay cannot fire from a single sensor's reading alone. At least 2 of 5 independently-scored modalities must agree the situation is genuinely elevated before actuation becomes possible.",
    realValue: "2-of-5 modalities ≥ 0.75, fused score ≥ 0.85",
    specReference: "AI/ML Spec §7.4",
    decisionReference: "DEC-015 (developer sign-off)",
  },
  {
    name: "Sustained-condition debounce",
    description: "A single instantaneous spike — sensor noise, a transient glitch — cannot trigger actuation. The elevated condition must hold continuously across several consecutive readings.",
    realValue: "4 consecutive cycles, ~4 seconds",
    specReference: "Firmware Spec §3.2",
  },
  {
    name: "Actuation cooldown",
    description: "Prevents the relay from rapidly cycling on and off if the fused score oscillates near the threshold — protects both the relay's mechanical life and the machine it switches.",
    realValue: "60 seconds minimum between actuations",
    specReference: "Firmware Spec §3.3",
  },
  {
    name: "Physical, firmware-independent override",
    description: "A manual switch wired in series with the relay's load-side output — not connected to any GPIO. It works even if every line of firmware on this device is behaving incorrectly, because it isn't part of the software system at all.",
    realValue: "Hardware series wiring, independent of software",
    specReference: "ADD §7.4, Firmware Spec §5",
  },
  {
    name: "Field-calibration burn-in gate",
    description: "On first deployment, actuation is structurally impossible — not just unlikely — for 1-2 weeks while the device learns this specific space's real baseline, before its judgment is trusted for autonomous action.",
    realValue: "operating_mode = BURN_IN blocks the CANDIDATE state entirely",
    specReference: "Firmware Spec §5",
    decisionReference: "DEC-019 (gap found), DEC-020 (developer sign-off)",
  },
  {
    name: "No auto-reverse",
    description: "Once the relay cuts power, it stays off until a human explicitly re-arms it. It never silently decides on its own that a safety action is no longer needed.",
    realValue: "Deliberate design — a protective action shouldn't self-reverse",
    specReference: "Firmware Spec §5",
    decisionReference: "DEC-015",
  },
  {
    name: "OTA integrity chain",
    description: "A new model is checksum-verified, then loaded in a sandboxed dry-run to confirm it initializes correctly, before ever becoming the active model — with two independent layers of rollback if anything fails.",
    realValue: "SHA-256 verify → sandboxed dry-run → atomic swap → software rollback (5 consecutive inference failures) → hardware bootloader rollback (independent, below this logic entirely)",
    specReference: "Firmware Spec §6",
    decisionReference: "DEC-019 (state machine gap found and closed)",
  },
  {
    name: "Idempotent telemetry",
    description: "A retried network submission can never create duplicate or double-counted records — including duplicate anomaly/actuation events, which would otherwise misrepresent what the device actually did.",
    realValue: "NVS-persisted sequence counter, server-side UNIQUE constraint",
    specReference: "Firmware Spec §7, Backend Spec §4",
  },
];
```

## FILE 2: `frontend/app/trust-audit/page.tsx`

```typescript
import { SAFETY_MECHANISMS } from "@/lib/trust-audit-content";

export default function TrustAuditPage() {
  return (
    <div className="max-w-3xl space-y-4">
      <p className="text-sm text-text-2">
        Every mechanism below is real, implemented, and traceable to the specific
        specification and engineering decision that established it — not a general
        claim about safety practices.
      </p>
      {SAFETY_MECHANISMS.map((mech) => (
        <div key={mech.name} className="rounded-xl border border-border bg-surface p-5">
          <h3 className="mb-1.5 text-base font-semibold text-text">{mech.name}</h3>
          <p className="mb-3 text-sm text-text-2">{mech.description}</p>
          <div className="flex flex-wrap gap-2 text-xs">
            <span className="rounded bg-calm-bg px-2 py-1 text-calm">{mech.realValue}</span>
            <span className="rounded bg-surface-2 px-2 py-1 text-text-3">{mech.specReference}</span>
            {mech.decisionReference && (
              <span className="rounded bg-surface-2 px-2 py-1 text-text-3">{mech.decisionReference}</span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
```

---

## Verification Steps

**Step 1:** `npm run build` — succeeds.

**Step 2 — the real check for a content page (re-verify every value, don't just confirm it renders):** read each `realValue` and `specReference` field against the actual live spec documents one more time — this is a static-content page, so its entire correctness burden is "does this text still match reality," not runtime behavior. Confirm all 8 entries still match after any spec changes made during Sessions 17-20's own gap-closures (e.g., confirm the OTA reference still correctly cites `DEC-019`, not a stale pre-fix description).

**Step 3:** Visually confirm the page reads as genuine documentation, not a marketing page — no unverifiable superlatives, only specific mechanisms with specific real values.

## Known open items
None.
