# Phase A.4 — Cross-Domain Boundary Inventory
**Every point where one subsystem's output becomes another's input, checked for whether both sides could be built independently and actually fit together.**

| # | Boundary | What the ADD specifies | What's missing | Resolves in |
|---|---|---|---|---|
| 1 | **Firmware → Backend** (device HTTPS POST) | "features and scores," sequence number, auth header (§12.1-12.4) | Exact JSON shape: field names per modality, types, whether raw + corrected values both travel or only corrected, timestamp format | Backend Spec + Firmware Spec — must be written as one shared contract, not two independent guesses |
| 2 | **Backend → Local tier** (the pull) | "pulls, frequent and incremental" (§14.1, §15.2) | Mechanism unspecified: polling on a timestamp/sequence cursor vs. Supabase Realtime subscription; exact query shape | Local MLOps Spec + Backend Spec |
| 3 | **Local tier → Device** (OTA artifact) | Checksum-verified, dry-run tested (§12.5) | Checksum algorithm not restated as a hard requirement in the ADD itself (assumed SHA-256 from earlier research, never locked in); exact metadata fields (version string format, size, timestamp) | Firmware Spec + Local MLOps Spec |
| 4 | **Local tier → Frontend** (what the public app can actually see) | **RESOLVED (DEC-003):** public app queries the cloud tier only, which now includes both recent raw-derived data and the new summary table | Exact query/view the frontend uses against the summary table | Backend Spec + Frontend Spec |
| 6 | **Local tier → Cloud** (new, added by DEC-003) | Periodic push of aggregated summaries only, never raw telemetry | Push frequency, exact aggregate schema, reliability approach (Registry #24-26) | Local MLOps Spec + Backend Spec |
| 5 | **Modality scores → Fusion** (the interface each modality presents) | "normalized against its own rolling baseline" (§9.5) | Exact value range/format (0-1 bounded? unbounded z-score?), how "individual threshold" comparison relates to the fused-score comparison | AI/ML Spec |

**6 boundaries checked (5 original + 1 added by DEC-003). All unblocked as of DEC-003 — everything else can proceed once Phase B actually writes the contract instead of each side assuming its own version.**
