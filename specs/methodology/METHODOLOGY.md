# REZON Implementation Methodology
### Adapted from the AEGIS spec-driven development methodology. Read this in full before doing implementation work.

---

## 0. What this document is, and isn't

This is REZON's version of the methodology document you'd hand a fresh Claude Code instance to onboard it onto how this project works. It's derived directly from a real prior project (AEGIS, a solo-built SAP helpdesk AI) — but it is not a copy. Three things are genuinely different about REZON, and this document exists specifically to handle them: **REZON has real physical hardware that no amount of code-reading can verify**, **REZON has a hard 5-6 week deadline with a mandatory 1-2 week calendar-time dependency (field-calibration burn-in) sitting inside it**, and **REZON has a safety-critical action (autonomous relay actuation) that can have physical consequences if the implementation drifts from spec**. Every deviation from AEGIS's original methodology below exists because of one of these three facts.

---

## 1. Core philosophy (unchanged from AEGIS)

Specs are upstream of code. The REZON Architecture Design Document (`specs/foundation/REZON_ADD.md`) is frozen foundational truth — 25 sections, already fully written, already survived six adversarial reviews. It is not re-derived here; it's referenced. Two roles stay separated: chat-based Claude (architecture, spec authoring, critical review — the role that produced the ADD and this methodology) and Claude Code (implementation — reads specs, writes real code, runs real commands, reports real results, does not invent architecture, stops and reports when reality doesn't match a spec's assumption rather than silently improvising). Work happens in discrete, verified sessions, each on its own branch, each genuinely verified before merge — never one continuous unverified stream of changes.

---

## 2. The tier structure (right-sized for REZON, not copied from AEGIS)

AEGIS ran for a long time and accumulated six tiers, including a full separate amendments directory and a historical archive. REZON starts today, has one implementer, and already has its foundational document fully written. Forcing AEGIS's exact six tiers here would be ceremony without a reason — so the structure collapses to what REZON actually needs:

```
rezon/
├── .claude/
│   └── CLAUDE.md                          # thin operating contract, loaded every session
├── specs/
│   ├── foundation/
│   │   ├── REZON_ADD.md                   # frozen — the 25-section architecture
│   │   └── AMENDMENTS.md                  # dated corrections layered on top, append-only, never edits the ADD directly
│   ├── verification/                      # living source of truth — highest authority, WITH ONE CARVE-OUT (§3)
│   │   ├── DECISIONS_LOG.md
│   │   ├── HW_VERIFICATION_LOG.md         # REZON-specific: physical evidence per hardware claim
│   │   ├── STATUS.md                      # short pointer doc, checked first every session
│   │   └── BLOCKER_REPORT_TEMPLATE.md
│   ├── methodology/
│   │   ├── METHODOLOGY.md                 # this file
│   │   ├── GIT_CONVENTIONS.md
│   │   └── SLASH_COMMANDS.md
│   ├── technical/                         # Phase B output — the layer between
│   │   │                                  # architecture (why) and sessions (how
│   │   │                                  # to build). Real algorithms, schemas,
│   │   │                                  # state machines. Sessions read THESE,
│   │   │                                  # not the ADD directly, for implementation
│   │   │                                  # detail.
│   │   ├── 01_AI_ML_TECHNICAL_SPEC.md
│   │   ├── 02_FIRMWARE_RTOS_TECHNICAL_SPEC.md
│   │   ├── 03_BACKEND_CLOUD_TECHNICAL_SPEC.md
│   │   └── 04_LOCAL_MLOPS_TECHNICAL_SPEC.md
│   ├── BUILD_ROADMAP.md                   # the phased schedule (§5)
│   └── sessions/
│       └── SESSION_NN_<name>.md           # one or two sessions ahead, never the whole project upfront
└── (the actual firmware / cloud-functions / frontend / local-stack code)
```

No separate `tier5_historical` yet — nothing has become historical. The first time an amendment genuinely supersedes something in a way worth archiving separately, that directory gets created then, not provisioned empty now (AEGIS's own bootstrap advice: match ceremony to actual project size).

---

## 3. The safety-critical override carve-out — the single most important deviation from AEGIS

AEGIS's rule: living verification (what's actually true right now) always overrides the frozen foundation when they disagree. That rule is correct and stays in force for REZON **everywhere except one place**.

**ADD §9 (AI/ML architecture), §11 (Actuation & Safety), and §12.2 (idempotency) do not follow that rule.** If an implementation session discovers a reason to deviate from the fusion logic, the corroboration requirement, the debounce/cooldown/boot-safe-state gates, the physical override, or the idempotency mechanism — that discovery gets logged as a **PROPOSED amendment** and implementation stops on that specific point until the developer explicitly signs off. It does not get treated as a routine reality-diverged-from-plan finding and quietly adopted the way a changed database column name would be.

Why this carve-out exists and AEGIS never needed one: AEGIS's worst-case bug was a broken feature. REZON's worst-case bug in this specific area is a relay firing when it shouldn't, or failing to fire when it should, on a real physical machine. The bar for "reality found something better than the spec" has to be higher here, with a human in the loop every time, not just logged after the fact.

---

## 4. The hardware verification extension — the second deviation from AEGIS

AEGIS's entire verification discipline (curl the real endpoint, query the real database, fetch a real JWT) is built for systems an agent can fully verify by itself, in its own sandbox. REZON has firmware wired to real sensors, a relay switching a real machine. Code that compiles and looks correct proves nothing about whether the microphone is actually wired right, whether the relay actually clicks, whether the current sensor's filtering actually smooths the noise it's supposed to.

**Rule: a session that touches hardware — sensor wiring, firmware sensing/acquisition code, actuation/GPIO code — is not complete until a physical observation is logged in `HW_VERIFICATION_LOG.md`.** A captured audio sample actually reviewed, a serial monitor transcript showing real sensor values changing when you physically perturb the sensor, a video/description of the LED or relay actually doing the thing, a multimeter reading confirming the voltage divider actually halves the MQ135 signal. This is AEGIS's own "live system over static reading" principle, extended into the one domain AEGIS's own history never had to cover.

**Consequence for session design:** hardware-touching sessions cannot be fully autonomous the way a pure-software AEGIS session could be. You need to be physically present for the verification step. Per your stated capacity, this is not a scheduling problem — the device is with you constantly — but it does mean these sessions get flagged explicitly (§6 risk-tiering) so neither of us treats "the code compiled" as "the session is done."

---

## 4.5. Where Phase A/B/C sit relative to BUILD_ROADMAP.md's phases (added in Phase C — this mapping didn't exist when the phases were first named, and leaving it unstated would be a real gap)

Phase A (precision audit), Phase B (four technical specs), and Phase C (this revision) are **not** a fifth build phase — they are what `BUILD_ROADMAP.md`'s "Phase 0 — Methodology & setup" actually turned out to require in full, once "become fully confident in the technical depth before writing specs" was taken seriously rather than treated as a formality. **Honest scheduling consequence:** `BUILD_ROADMAP.md` originally sized Phase 0 at 1-2 days. The real depth of Phase A+B+C — a precision audit, four technical specifications each resolving real algorithms and schemas, and this revision — took meaningfully longer than that in practice. **`BUILD_ROADMAP.md`'s Phase 1 day-count should be read as starting now, from Phase B's actual completion, not from the calendar day the project began.** This is flagged explicitly rather than silently absorbed, because pretending the original Day 1-14 estimate for Phase 1 still holds unchanged would understate real pressure on the back half of the schedule — see the updated note in `BUILD_ROADMAP.md` itself.

## 5. The timeline reconciliation — the third deviation from AEGIS, and the one unique to REZON's actual constraint

You've held three things fixed: full rigor, full ADD scope, full spec ecosystem upfront. Those are compatible with a 5-6 week deadline **only** if the schedule itself is engineered around the one real hard dependency: the field-calibration burn-in (ADD §10.4) needs the device fully built and running for 1-2 weeks before it can graduate to trusted operation — but that's *calendar* time, not *work* time. The full schedule is in `specs/BUILD_ROADMAP.md`; the structural idea is:

- **Phase 1 (front-loaded):** get a genuine, non-corner-cut v1 device — all five modalities wired and firmware-working, a Stage-1/Stage-2 trained model on it, minimal-but-real fusion/safety logic, basic Supabase reporting — into burn-in mode as early as possible.
- **Phase 2 (parallel, during burn-in):** while the device quietly logs itself in the background, build everything that doesn't depend on a calibrated model — the full frontend, the full local MLOps tier, cloud hardening, deeper spec/decisions-log content, the Part-8-style current-facts research pass.
- **Phase 3 (post-burn-in):** the calibration fine-tune, graduation to full alert/actuation mode, live safety-gauntlet testing (physically inducing the debounce/cooldown/corroboration conditions and confirming the gates behave correctly — not just reading the code), OTA round-trip verification, integration, demo rehearsal, buffer.

This is why the spec ecosystem is authored in full now (this batch of documents) while **per-session implementation specs are still written just-in-time**, one or two sessions ahead — that part of AEGIS's advice doesn't change just because the methodology layer is being front-loaded. Writing all of Phase 3's session specs today, before Phase 1 has taught us anything real about the hardware, would just be more stale-plan-vs-reality drift waiting to happen.

---

## 6. Risk-tiered session ceremony

AEGIS applied one uniform level of ceremony to every session. For REZON, under real time pressure, uniform ceremony risks two failure modes: too little rigor on the sessions that can hurt something physical, or so much friction on routine work that the discipline quietly erodes from being applied everywhere indiscriminately. Two tiers:

**HIGH-RISK** (full three-pass spec read, physical verification where applicable, safety-carve-out awareness): anything touching sensor acquisition/firmware, the fusion/scoring/threshold logic, actuation/relay/GPIO code, the audio model's training or quantization, OTA mechanics, auth/idempotency.

**ROUTINE** (spec read, real verification still required and still logged, but without the full physical-evidence and safety-signoff machinery): frontend components, Grafana panels, documentation, most local-MLOps scaffolding, styling.

Every session, regardless of tier, still gets a real Decisions Log entry and still needs its verification to genuinely pass. The tiering changes *how much ceremony*, never *whether it's verified*.

---

## 7. Research discipline for time-sensitive facts (directly from AEGIS Part 8, genuinely important here)

A meaningful amount of REZON's own cloud/tooling research (Supabase limits, board listings, library versions) was done earlier in this project's design conversation — which means, by the time implementation actually starts, some of it may already be stale, the same way AEGIS discovered mid-project that two of its configured AI models had been silently deprecated. **Before Phase 1 locks in anything time-sensitive as fact, do a live re-check**, not a recall from the ADD or this conversation: current Supabase free-tier limits, current ESP-IDF/board firmware tooling versions, current Next.js/shadcn versions, current library compatibility. Disagreement between sources on any of these is itself a finding, not noise — it means build in a fallback, don't hardcode the assumption. This is Session 1's explicit first task (see `specs/sessions/SESSION_01_environment_and_pin_mapping.md`).

---

## 8. Everything else — unchanged from AEGIS, adopted as-is

The Decisions Log discipline (append-only, numbered, superseded-not-edited, real evidence per entry), the Blocker Report stop-and-report protocol, the four slash commands (adapted names, `specs/methodology/SLASH_COMMANDS.md`), git conventions (one branch per session, no `dev` layer, merge only after verification passes, never push without being asked), the verification philosophy in full (live over static, exercise the real failure condition rather than reading the handling code, grep for the literal thing and report the count, distinguish statically-checked from dynamically-verified explicitly), and chat-Claude's ongoing role (review critically, never rubber-stamp; verify independently against real stored files; correct its own past mistakes visibly; batch large deliverables for quality; ask focused questions before consequential undertakings, decide when asked to decide) — all of it transfers to REZON exactly as AEGIS ran it. None of that needed to change; it isn't specific to AEGIS's domain, it's specific to solo-agent-implemented projects generally.

---

## 9. Claude Code's own memory (separate from `specs/` — added post-Phase-C)

Distinct from everything above: Claude Code maintains its own project-scoped memory at `~/.claude/projects/<project-slug>/memory/`, loaded automatically every session, independent of the repo.

**What belongs here vs. in `specs/verification/DECISIONS_LOG.md`:** the Decisions Log is REZON's official, versioned, git-tracked truth — what any reader should trust. This memory is lighter-weight session continuity — things that would otherwise get silently re-discovered every session: environment-specific gotchas, "we already tried X, it didn't work," a compact restatement of working style. **Never duplicate what the repo already records** — that's a staleness risk with no benefit.

**Structure:**
```
~/.claude/projects/rezon/memory/
├── MEMORY.md              # one-line index, loaded every session
├── user-profile.md        # working style, skill level, preferences (seed below)
└── <topic>.md              # one fact per file, added as real things are found
```

**Seed `user-profile.md` with (Session 0 task):**
```
---
name: user-profile
description: Developer's working style and background for REZON
metadata:
  type: user
---
Self-taught, built and ran a production spec-driven methodology (AEGIS)
solo before this project. Wants full engineering rigor, no shortcuts
taken silently under time pressure. Hands-on review for firmware/
safety-critical sessions; checkpoint-level trust for routine cloud/
frontend work. Prefers small, tightly-verified increments over long
autonomous stretches. Wants genuinely minor implementation judgment
(naming, small structuring) left to Claude Code; nothing architectural
decided without explicit confirmation.
```

**Discipline:** before writing a new memory, check for an existing file on the same topic and update it, don't duplicate. Delete memories found to be wrong rather than leaving them to mislead a later session.

## 10. Parallel subagent audit — with a real, evidence-based caveat (revised)

For a verification pass too large for one session's context to cover with real depth: do a direct orientation pass first, split scope into clusters matching subsystem boundaries, brief each with specific pointed questions, not "review this."

**Critical caveat, from real evidence (a documented AEGIS incident, not a hypothetical):** three independent subagents once unanimously agreed on the same wrong answer, because all three shared the same underlying data-access flaw (stale reads over a network-mounted filesystem), not because the answer was correct. **N-way agreement is only real corroboration if the methods are genuinely independent — same tool, same access path, same blind spot is not independence.** When multiple clusters converge on a finding, cross-check at least once via a genuinely different access method (a different read approach, a delayed re-run) before trusting the convergence, especially for anything safety-critical.

**Now scheduled at two points, not one:** a lightweight mid-Phase-1 audit (after Session 4-5, auditing Sessions 1-4 against their specs before continuing — catching drift while it's still cheap to fix) and the full Phase 3 final integration check. This directly responds to real evidence: AEGIS's own single end-of-project audit found 11 of 16 sessions had a real, previously-undetected issue — silent config drift, a formula implemented with the wrong operator, an entire pipeline stage missing. Complete-code specs and a real verification discipline did not prevent this; only dedicated re-auditing caught it, and only because it happened at all. One audit at the very end is not enough — REZON schedules two.


## 11. Evidence-citation discipline for STATUS.md (added from real AEGIS incident)

A real AEGIS incident: two status documents simultaneously claimed contradictory things about whether tests were passing — one said "confirmed by running the real suite," the other said "not yet run." Both were trusted as current at different points; nothing forced reconciliation before it caused confusion. **Hard rule for REZON's `STATUS.md`: any "passing," "complete," or "verified" claim must cite the actual command and output that proved it, not just assert the state.** If two sources ever disagree, that disagreement itself gets logged and resolved — never silently pick whichever one you read most recently.

## 12. Session types: build vs. verification (clarified from real AEGIS structure)

Real AEGIS session specs split into two structurally different types, not one template scaled by size: **build sessions** (Agent Instructions → Attach list → Prerequisites → complete, exact, runnable code per file → Verification Steps with literal expected output) and **verification/audit sessions** (pure checklist, no code-delivery section at all, because there's nothing to implement). REZON's Sessions 3, 5, 6, 8 (writing firmware/training/backend code) are build-type — going forward, these carry **complete code, not pseudocode-referencing prose**, matching the real AEGIS pattern (average ~900 lines for a genuine build session with real code, tests, and literal verification output — a significantly bigger deliverable per session than earlier REZON sessions, and worth setting that expectation explicitly). Sessions like the mid-Phase-1 audit (§10) and Phase 3's final integration check are verification-type — checklists, no code.

## 13. Skill-gap observation logging (a real AEGIS gap, fixed here)

AEGIS never systematically logged skill-gap or working-style observations as they happened — by its own admission, this is why those answers were thinner than the technical ones. REZON fixes this directly: **any real, specific skill-gap moment during a session gets logged as its own Claude Code memory entry** (§9's `feedback`-type memory), the same way `DECISIONS_LOG.md` logs technical decisions — not just relied on as a one-time upfront profile that goes stale.
