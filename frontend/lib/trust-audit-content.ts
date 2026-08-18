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
