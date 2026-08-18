# REZON — Build Roadmap
**The schedule that reconciles full ADD scope + full rigor with a real 5-6 week deadline. The organizing idea: the field-calibration burn-in (ADD §10.4) is calendar time, not work time — so the schedule is three phases, not one long sequential build.**

This is a planning document, not a rigid contract — dates will slip in the normal way real engineering slips. What must not slip is the *sequencing logic*: Phase 1 has to produce a genuine (not corner-cut) device before burn-in can start, because burn-in's calendar clock is the actual critical path constraint of the whole project. Everything in Phase 2 is scheduled to happen *during* that clock specifically because it doesn't depend on the clock having finished.

---

## Phase 0 — Methodology & setup (revised — see honest note below)

**Originally sized at 1-2 days. In practice, Phase 0 grew to include a full precision audit (Phase A) and four technical specifications (Phase B) — 26 real parameters, algorithms, and schemas resolved, two documents flagged for safety-critical sign-off — because "become fully confident before writing specs" was taken seriously rather than treated as a formality.** That work is now genuinely done and was worth the real time it took — but it took real time, and pretending otherwise would understate pressure on the rest of the schedule.

**Honest scheduling consequence: read Phase 1's day-count below as starting now, from Phase B's actual completion — not from the calendar day this document was first written.** If your true remaining runway is now closer to the tight end of your original 5-6 week estimate, the sequencing logic (front-load Phase 1, parallelize Phase 2 during burn-in) still holds and is still the right structure — it just means less slack exists in Phase 3/buffer than the original plan assumed. Worth tracking honestly in `STATUS.md` from Session 1 onward, not discovered later.

**Session 0 (dry run, before Session 1 — added post-Phase-C):** you have never run a Claude Code session on this repo. Before Session 1 carries real informational stakes, do one trivial, low-risk pass: confirm `git`/Claude Code mechanics actually work, generate the four slash command files from `SLASH_COMMANDS.md`, and seed Claude Code's own `user-profile` memory (§9). This is the practical version of "verify, don't assume" applied to the toolchain itself.

Remaining before Phase 1 starts: `SESSION_01` (current-facts verification pass, repo scaffolding, GPIO pin-mapping table, slash commands installed).

---

## Phase 1 — Front-loaded sprint to genuine burn-in (target: Days 1-14)

**This is the highest-risk, highest-priority phase in the whole schedule — everything else's timeline depends on this finishing on time, because burn-in cannot start until it does.**

| Days | Work | Risk tier | Depends on |
|---|---|---|---|
| 1 | Session 1: current-facts check, pin-mapping table, repo scaffold | Routine | — |
| 2-3 | Hardware assembly & wiring, all 5 sensors + relay + override switch + LED + buzzer, each physically verified (`HW_VERIFICATION_LOG.md`) | **High-risk** | Day 1 |
| 4-6 | Firmware: RTOS Core0/Core1 skeleton, sensor acquisition task, feature extraction task (ACS712 filtering, MQ135 compensation, IMU spectral-band features — all mandatory, not deferred), physically verified per modality | **High-risk** | Days 2-3 |
| 7-9 | Audio model: Stage 1 (public data, ESC-50/UrbanSound8K-weighted) + Stage 2 (augmentation + synthetic anomalies) on Colab, QAT quantization, IDNN-vs-plain-AE A/B on a genuine held-out split, deploy to device | **High-risk** | Day 1 (current-facts check on training tooling) |
| 10-11 | Fusion + two-threshold decision + full actuation safety gate (2-of-N corroboration, debounce, cooldown, boot-safe default, physical override) — bench-tested, not yet live | **High-risk, safety-critical (sign-off required)** | Days 4-9 |
| 12-13 | Minimal Supabase connectivity: Edge Function ingestion, per-device secret auth, idempotency sequence numbers, basic telemetry table | **High-risk** | Day 1 (current-facts check on Supabase limits/APIs) |
| 14 | Integration check, deploy device to real target space, **START BURN-IN CLOCK** | High-risk | All of the above |

**If Phase 1 is running long by day 10-11:** the lever to pull is compressing Phase 2's sequencing or trimming the end-of-project buffer — not cutting a modality or a safety gate. Flag it honestly in `STATUS.md` the moment it's visible, don't discover it on day 14.

---

## Phase 2 — Parallel build during burn-in (target: Days 14-24, runs alongside the ~1-2 week burn-in clock)

The device is logging itself in the background. None of this work touches the device or depends on a calibrated model.

- Full frontend — all three zones (Monitor/Analyze/Manage) + public status page, per the prototype already built and `specs/foundation/REZON_ADD.md` §17
- Full local MLOps tier — self-hosted TimescaleDB (with retention policy + continuous aggregates from day one, per ADD §15.3), MLflow, Evidently-as-library, Grafana, the one scheduled script
- Cloud hardening — Row-Level Security tightened, operator/viewer roles, OTA storage/publish path fully wired
- Deepen the spec ecosystem — Decisions Log entries for everything actually found, amendments as needed
- Any remaining Part-8-style current-facts checks not already done in Phase 1

**Routine-tier ceremony applies to most of this** (per `METHODOLOGY.md` §6) — this is where the lighter process pays for itself, since none of it is safety-critical.

---

## Phase 3 — Post-burn-in integration (target: Days 24-30)

- Calibration fine-tune pass: retrain the audio model and calibrate fusion weights/thresholds on real burn-in data (ADD §10.4)
- Graduate the device to full alert/actuation mode
- **Live safety-gauntlet testing** — physically induce the conditions (a real anomaly-like event, a borderline case, a rapid-oscillation case) and confirm corroboration/debounce/cooldown/override actually behave as specified — not inferred from code, physically observed and logged
- OTA round-trip test — publish a model, confirm download/checksum/dry-run/swap, and deliberately induce a failure to confirm rollback actually works
- End-to-end integration pass through all four ADD §19 workflows (normal operation, anomaly→actuation, drift→retrain→redeploy, burn-in itself already complete)

**This entire phase is high-risk, safety-critical tier.**

---

## Remaining time — demo prep, viva prep, buffer (Days 30 through end of week 5-6)

- Multiple full demo rehearsals, including the institutional-network MQTT/HTTPS reachability test from a real evaluation-like network
- Viva prep — review the ADD's decision log (§23) and this project's own Decisions Log, be ready to explain any choice and its rejected alternatives
- Buffer for whatever slipped — there is always something

---

## The one thing to monitor most closely

**STATUS.md should be updated honestly, every session, especially about whether Phase 1 is on pace.** The single biggest risk to this whole schedule isn't any individual task being hard — it's Phase 1 quietly running long without that being visible until burn-in starts late, compressing everything after it. Catch that early, not on day 14.
