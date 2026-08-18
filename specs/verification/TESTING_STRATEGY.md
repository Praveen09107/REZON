# REZON — Testing Strategy
**Production-grade verification, layer by layer. Automated tests where the tooling genuinely supports proving correctness; physical verification where only reality can (per HW_VERIFICATION_LOG.md — this document does not duplicate that, it covers what automated tests can actually check).**

---

## 1. Philosophy

Not "100% coverage everywhere" — coverage effort matches real risk, per the same risk-tiering the whole methodology already uses (METHODOLOGY.md §6). Safety-critical logic (fusion, actuation gating) gets the deepest testing. Routine glue code gets proportionate, not maximal, coverage. Every test's expected output is stated literally (per real AEGIS practice, e.g. "expect 1.00"), never "should work."

## 2. Firmware (C / ESP-IDF)

**Unit tests — host-based, run on the development machine, not the device:** pure-logic functions (the fusion scoring formula, the ACS712/MQ135 filter math, the actuation state machine's transition logic) get extracted into functions testable independent of hardware, using the Unity test framework (ESP-IDF's standard). This lets the safety-critical logic specifically be tested exhaustively and fast, without needing the board for every test run.

**What cannot be unit tested, and isn't pretended to be:** "does the microphone actually produce a real signal," "does the relay actually click." These are `HW_VERIFICATION_LOG.md`'s job — a different kind of evidence, not a gap in this document.

**Integration tests — on real hardware, via serial monitor output:** confirming the RTOS task structure behaves as designed (no audio glitches under load, correct task priorities actually enforced) — this is inherently a real-device check, logged with actual captured output.

## 3. AI/ML Training Pipeline (Python)

**Unit tests (pytest):** data pipeline functions — augmentation transforms, the held-out split logic (confirming it's genuinely session/day-stratified, not random-frame, per AI/ML Spec §8), the score-normalization function (AI/ML Spec §6.1).

**The real integration/quality test is already defined and non-negotiable:** held-out AUC ≥0.85 (AI/ML Spec §8). This is the model-correctness gate, not a separate thing to add.

## 4. Backend (Supabase Edge Functions)

**Unit tests:** the idempotency dedup logic, the RLS-bypass-via-service-role pattern, the summary-pipeline UPSERT logic — testable in isolation.

**Integration tests — against a real Supabase project (a test/staging project, not mocked), consistent with the project's own "live verification over static reading" principle:** the full `/ingest` request/response cycle, confirming duplicate submissions are genuinely deduplicated by hitting the real endpoint twice with the same sequence number and checking the real database state, not just reading the code and assuming it works.

## 5. Local MLOps (the scheduled script)

**Unit tests (pytest):** each pipeline stage in isolation (drift check, retrain trigger logic, promotion-gate comparison).

**Integration test:** running the full script against a small real test dataset, confirming the actual sequence (pull → aggregate → summary-push → drift-check → retrain-if-triggered) executes correctly end to end.

## 6. Frontend (Next.js)

**Component tests (Vitest) + end-to-end tests (Playwright)** — automated-first, matching the real, confirmed AEGIS pattern (their own `FRONTEND_VERIFICATION_STANDARDS.md` superseded an older manual checklist for exactly this reason). Covers the resilience states specifically (ADD §17.5's stale/disconnected rendering) — these are easy to silently break and easy to automated-test for.

## 7. System-level (ties back to existing mechanisms, not new ones)

The two scheduled audits (mid-Phase-1, end-of-Phase-3, per DEC-013) and the four ADD workflow walkthroughs (§19) already serve as the system-level/end-to-end integration check — this section names them as part of the testing strategy explicitly, rather than leaving them implied only in the roadmap.

## 8. What "done" requires, per session

A build-type session (METHODOLOGY.md §12) is not verification-complete until: its unit tests exist and pass (where applicable per the layer above), and — for anything hardware-touching — a real `HW_VERIFICATION_LOG.md` entry exists. Both, not either.
