# SESSION 35 — Live Safety-Gauntlet Test
**Risk tier: MAXIMUM — the first time the full safety chain is tested against the REAL monitored machine, in real FULL_OPERATION mode, not a bench LED substitute (Session 9) and not a unit test (Session 7). This is the single highest-stakes physical session in the entire project.**
**Branch: `session/audit-35-safety-gauntlet`**
**Attach: `02_FIRMWARE_RTOS_TECHNICAL_SPEC.md` §5, Sessions 07, 09, 34 (as actually built), `HANDBOOK_05_DEMO_DAY_RUNBOOK.md`**

---

## Before you begin — real physical safety, not a formality

This session deliberately, repeatedly cuts and restores power to a real machine. Confirm before starting: the machine can be safely power-cycled without damage (check its own documentation, not assumed), someone is physically present the entire time, and the physical override switch is confirmed reachable and functional *before* any test that could actually actuate.

## Prerequisites — verify, don't assume

- [ ] `SESSION_34` genuinely complete — confirm via real device log that `operating_mode = FULL_OPERATION`, not assumed from the calendar.
- [ ] The physical override switch tested once, standalone, before anything else in this session: engage it, confirm the relay is forced safe regardless of any other state — this is the very first thing to verify, since it's your real safety net for every test that follows.

---

## The test protocol — six real, physical tests, in order

### Test 1 — single-modality spike (must NOT actuate)
Induce a real spike in exactly ONE modality (e.g., a brief loud sound near the mic) — brief, not sustained. **Expected: no actuation.** Confirm via log that corroboration count stayed below 2, or that the debounce counter never incremented, depending on which gate correctly blocked it. Log the real result in `HW_VERIFICATION_LOG.md` — including which specific modality and score value you observed, not just "test passed."

### Test 2 — two-modality condition, under debounce window (must NOT actuate)
Induce a real, genuine two-modality elevated condition (e.g., shake the board near a running fan while breathing on the gas sensor) but stop it well before ~4 seconds. **Expected: no actuation** — confirm via log the debounce counter incremented but reset without reaching 4, and a suppressed-by-debounce event was logged (per Firmware Spec §5's explicit logging requirement).

### Test 3 — two-modality condition, sustained past debounce (SHOULD actuate) — the real moment
Same induced condition as Test 2, sustained for genuinely over 4 seconds. **Expected: real actuation — the relay genuinely cuts power to the real monitored machine.** This is the actual, physical proof of everything signed off since `DEC-015`. Confirm: the machine genuinely loses power, the device logs a real actuation event with the correct `contributing_modalities` breakdown, and this event appears in the real Supabase `anomaly_events` table within seconds.

### Test 4 — immediate re-trigger attempt (must NOT re-actuate, cooldown holds)
Immediately after Test 3, without re-arming, attempt to induce the same qualifying condition again. **Expected: no second actuation** — confirm via log a suppressed-by-cooldown event, and confirm the real machine remains off (cooldown governs re-actuation eligibility, not restoring power — per `DEC-015`'s signed-off no-auto-reverse design, restoring power was never going to happen automatically regardless of cooldown state).

### Test 5 — override engaged during an active elevated condition
While inducing a genuine elevated condition (real corroborating scores, mid-debounce-count), physically engage the override switch. **Expected: the relay is forced safe immediately, and this happens regardless of the software state machine's own internal count** — confirm via log that the state machine was genuinely bypassed (per Firmware Spec §5's explicit design), not that it happened to reach the same conclusion independently.

### Test 6 — re-arm after actuation (confirms no-auto-reverse, end to end, physically)
With the machine still off from Test 3 (assuming cooldown has now elapsed and Test 4/5 didn't leave it in an ambiguous state — sequence these tests with enough real time between them, don't rush), confirm the machine genuinely stays off with no further action from you. Then perform the real re-arm action (frontend "auto-response" control, or the physical mechanism, per ADD's design) — confirm power is restored **only** as a result of that explicit action, never on its own.

---

## Verification gate

All 6 tests must show the expected real outcome, each logged in `HW_VERIFICATION_LOG.md` with the actual observed values (scores, timestamps, log lines) — not "test passed," but what was actually seen. **Any test producing an unexpected result is a Blocker Report, not a retry-until-it-works** — an actuation-safety test behaving unpredictably is exactly the class of finding that must stop and get investigated, never quietly re-attempted until it happens to pass.

## Known open items
None — this session is the physical validation of everything already built; it doesn't introduce new code.
