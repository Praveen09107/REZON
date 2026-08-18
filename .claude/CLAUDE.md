# CLAUDE.md — REZON Project Memory

## What this is
REZON is a privacy-preserving, multimodal edge-AI anomaly monitoring platform (ESP32-S3, 5 sensing modalities, on-device inference, autonomous relay actuation, Supabase cloud tier, self-hosted local MLOps tier, Next.js frontend). Solo capstone project, real deadline ~5-6 weeks out, evaluated via live physical demo + viva/code walkthrough. Full history and reasoning: `specs/foundation/REZON_ADD.md`.

## Current status
**Always check `specs/verification/STATUS.md` first. Never assume from this file — status changes every session, this file does not.**

## Who you're building for
A solo student who has already done extensive architecture design and review (the ADD survived six adversarial review passes) and has real prior experience running a spec-driven Claude Code methodology solo on a production project (AEGIS). Comfortable with deep technical reasoning — explain *why*, not just *what*, especially for anything touching AI/ML or safety logic. Wants full engineering rigor; does not want shortcuts quietly taken under time pressure. Hands-on and wants to review real work for firmware/safety-critical sessions; comfortable with checkpoint-level trust for routine cloud/frontend sessions.

## The Rules — non-negotiable, every session
1. **The ADD is frozen. Read `specs/verification/STATUS.md` and `specs/verification/DECISIONS_LOG.md` before trusting any claim in it that could have changed.**
2. **Safety-critical sections require explicit sign-off to change, not silent supersession.** ADD §9 (AI/ML), §11 (Actuation & Safety), §12.2 (idempotency) do NOT follow the normal "living verification overrides frozen foundation" rule. A discovered need to deviate here gets logged as a PROPOSED amendment and stops for explicit developer approval before it's treated as settled. See `specs/methodology/METHODOLOGY.md` §3 for why.
3. **No placeholder code, ever.** No TODO, no bare `pass`/stub return, no "implement later" comment left in a session marked complete.
4. **Never invent architecture.** Build exactly what the current spec (as corrected by the Decisions Log) says. Something genuinely useful but out of scope gets named as a new OPEN item, not built silently.
5. **Every verification step in a session's spec must genuinely pass before the session is complete.** One failing check = incomplete, not "mostly done."
6. **Hardware-touching sessions require physical evidence, not code-correctness inference.** A captured sample, a serial log, a multimeter reading, a described physical observation (LED lit, relay clicked, buzzer sounded) — logged in `specs/verification/HW_VERIFICATION_LOG.md`. "The wiring/code looks correct" is not a verified claim for anything touching a real sensor or the relay.
7. **When a spec's assumption doesn't match reality, stop and report — do not silently adapt.** Use the Blocker Report format (`specs/verification/BLOCKER_REPORT_TEMPLATE.md`).
8. **For anything whose current state could have changed since training (library versions, API limits, current pricing/free-tier terms, model/board availability) — search, don't recall.** See METHODOLOGY.md §6.

## Architecture facts that must never be violated
- MCU: ESP32-S3-WROOM-1 N16R8 (16MB flash, 8MB PSRAM). Hardware is fixed — not open for reconsideration.
- 5 scored modalities (fused and corroborated): audio (INMP441→IDNN neural model), vibration (MPU-6050+SW-420→spectral-band statistical scoring), environment (DHT22+BMP280→statistical scoring, per AI/ML Spec §6 — a genuine anomaly signal in its own right, e.g. fire/HVAC-failure detection, in addition to its role compensating the gas sensor), gas (MQ135, temp/humidity-compensated), current (ACS712, filtered — measures the relay-controlled machine itself).
- Fusion: weighted scores + 2-of-N modality corroboration required before actuation. Two thresholds (alert < response), never one.
- Actuation gates, ALL required: 2-of-N corroboration → sustained-condition debounce → cooldown since last actuation → boot-safe default state enforced → physical override switch (independent of firmware) can force safe state regardless.
- Transport: direct HTTPS to Supabase Edge Functions (NOT MQTT). Every submission carries a monotonic per-device sequence number; server deduplicates. This is mandatory, not optional — it is the specific cost of the HTTPS-over-MQTT decision.
- Cloud: Supabase only (DB+Auth+Storage+Functions) — do not introduce a second cloud vendor. Frontend: Next.js on Vercel.
- Local tier: full self-hosted TimescaleDB, MLflow, Evidently-as-library (not a service), Grafana, ONE scheduled script (not Airflow/Prefect). Reachable only via Tailscale — never publicly exposed.
- Field-calibration burn-in: device must run 1-2 weeks in logging-only mode (alerts suppressed, actuation disabled) in the real target space before graduating to full operation. This is a required milestone, not optional polish.
- Data durability: three-copy (device SD + Supabase + local TimescaleDB), kept as a deliberate full feature.
- Data flow: raw telemetry stays strictly one-directional (device→cloud→local). A second, narrow channel (local→cloud, AGGREGATED SUMMARIES ONLY, never raw) feeds the public frontend's Analytics zone — added by DEC-003/AMENDMENT-001. Do not confuse this with a reversal of the core one-directional principle for raw data.

## Drift patterns to actively watch for
1. **Reaching for MQTT, Oracle Cloud, Firebase/Appwrite, Airflow/Prefect, or public-exposed admin tooling.** All were explicitly evaluated and rejected across multiple review rounds. If a session seems to need one of these, that's a signal to stop and check the ADD's reasoning (§23 Decision Log), not to reach for the "standard" choice.
2. **Treating actuation like alerting.** Alerting can fire on one modality. Actuation requires the full gate in "Architecture facts" above, every time, no exceptions for "obviously correct" cases.
3. **Quantizing after training instead of QAT.** The audio model uses Quantization-Aware Training specifically because plain post-training quantization degrades the precision the anomaly score depends on.
4. **Skipping the ACS712 filtering or MQ135 temp/humidity compensation "for now."** Both are mandatory feature-extraction steps, not later polish — without them the sensor produces untrustworthy scores that undermine the reason it was included.
5. **Trusting a training-data-era fact about a fast-moving service (Supabase limits, board availability, library versions) instead of checking live.** See Rule 8.

## Environment
(Fill in once repo is initialized: real paths, board COM port, Wi-Fi test network name, Supabase project ref, Tailscale node name.)

## Where the real detail lives
- Full architecture and reasoning (the "why"): `specs/foundation/REZON_ADD.md`
- **Exact algorithms, values, and schemas (the "how" — check here BEFORE inventing or guessing any parameter, formula, or state machine):** `specs/technical/01_AI_ML_TECHNICAL_SPEC.md`, `02_FIRMWARE_RTOS_TECHNICAL_SPEC.md`, `03_BACKEND_CLOUD_TECHNICAL_SPEC.md`, `04_LOCAL_MLOPS_TECHNICAL_SPEC.md`. Every value carries a confidence marker (🟢/🟡/🔴) — a 🔴 value is an honest placeholder pending real hardware data, not a settled constant; a session hitting a 🔴 value should treat resolving it as real work, not skip past it.
- **How to generate the NEXT session's spec, without external help:** `specs/methodology/SESSION_GENERATION_PROTOCOL.md` — run this at the start of every session where the next one isn't written yet.
- **What testing is required, per layer, before a session counts as done:** `specs/verification/TESTING_STRATEGY.md`
- The full inventory of every resolved parameter and where it lives: `specs/verification/PARAMETER_REGISTRY.md`
- Why any decision was made: `specs/verification/DECISIONS_LOG.md`
- Is a hardware claim actually physically verified: `specs/verification/HW_VERIFICATION_LOG.md`
- What's next / current phase: `specs/verification/STATUS.md`
- The build roadmap and phasing logic: `specs/BUILD_ROADMAP.md`
- Full methodology reasoning (why this structure exists): `specs/methodology/METHODOLOGY.md`
- Git/branch conventions: `specs/methodology/GIT_CONVENTIONS.md`
- Blocker report format: `specs/verification/BLOCKER_REPORT_TEMPLATE.md`

## Common commands
```bash
# Firmware
idf.py build && idf.py -p <PORT> flash monitor

# Cloud functions (local test)
supabase functions serve

# Local MLOps stack
docker compose up -d
docker compose logs -f

# Frontend
npm run dev
```

## Spec-reading discipline
Before writing anything: read the session's spec in full (no writing in between), check whether every file it touches already exists from a prior session (and whether the spec correctly assumes new-vs-modify), and confirm anything it imports/depends on from an earlier session actually exists and contains what's expected. If any of this doesn't line up — stop, don't guess.
