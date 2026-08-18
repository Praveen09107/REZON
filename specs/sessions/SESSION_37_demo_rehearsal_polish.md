# SESSION 37 — Demo Rehearsal & Final Polish
**Risk tier: ROUTINE (no new safety-critical logic) — but this is the last session in the entire build, closing what started as a 25-parameter precision audit and ends here as a working, physically-tested, autonomous safety system.**
**Branch: `session/build-37-demo-rehearsal`**
**Attach: `HANDBOOK_05_DEMO_DAY_RUNBOOK.md`, `AUDIT_02` results (as actually run), the full `DECISIONS_LOG.md`**

---

## Agent Instructions

Two things: final cosmetic/small polish items surfaced but not yet closed across the build, and a genuinely rehearsed, timed demo script — built from what actually happened in this project, not a generic pitch.

**What this session creates:**
- `frontend/lib/demo-mode.ts` — the guided walkthrough from the elevation vision's Pillar 6, finally implemented
- A rehearsed script, timed, using this project's own real history as material

---

## FILE 1: `frontend/lib/demo-mode.ts`

```typescript
// The "demo mode" use case named in the elevation vision (a guided,
// narrated walkthrough) — implemented simply as a scripted sequence
// of route navigations with real narration text, not a separate
// simulated data path (which would risk misrepresenting what the
// live system actually does).
export const DEMO_SCRIPT = [
  { route: "/", narration: "This is REZON's live view — five real sensors watching this space right now." },
  { route: "/safety-chain", narration: "This is the actual safety gate sequence — not a description of it, the real, live pipeline." },
  { route: "/trust-audit", narration: "Every mechanism here is real and traceable to a specific engineering decision — including two that only exist because we found and fixed real gaps during the build." },
  { route: "/incidents", narration: "Past events, sorted by how uncertain they were — the ones worth a human's attention first." },
  { route: "/since-calibration", narration: "The model didn't start this good — it learned this specific space during a real two-week burn-in period." },
];
```

## FILE 2: Rehearsed demo script (for you, not for Claude Code to implement — this is the actual content)

**Total time: ~4 minutes. Rehearse this for real, out loud, at least twice before the actual demo.**

**0:00-0:30 — Open on the Home page.** *"REZON watches a real space using five independent senses — sound, vibration, environment, gas, and the electrical current of the machine it can control. It's not looking at a video feed or reading a script — everything you're about to see is live."*

**0:30-1:15 — Trigger a real, physical anomaly** (per your rehearsed protocol from `SESSION_35`). *"Watch the confidence strip — that's not a mockup, that's five real sensors updating live."* Let the alert fire naturally.

**1:15-2:00 — Switch to the Safety Chain Monitor.** *"This is the part most projects at this level don't have — REZON doesn't just detect, it makes an autonomous decision about whether to act, and every gate in that decision is visible, right here, live."* Walk through the pipeline stages as they actually light up.

**2:00-2:45 — Switch to the Trust Audit page.** *"Every one of these mechanisms is real — and two of them exist specifically because we found real gaps while building this and fixed them. I can show you exactly which decision closed each one."* (Have `DECISIONS_LOG.md` ready if asked to go deeper — `DEC-019` and `DEC-020` are the strongest concrete example: a real safety gap found during our own audit, not assumed away.)

**2:45-3:30 — Since Calibration page.** *"The model wasn't handed perfect accuracy — it trained on public data first, then spent two real weeks learning this specific room before it was ever trusted to act autonomously."*

**3:30-4:00 — Close on the physical override switch.** *"And if everything above is somehow wrong — this switch works independent of all of it. It's not connected to any code."* Physically demonstrate it.

---

## Final polish checklist — small, real, closable items only

- [ ] Confirm `HANDBOOK_05_DEMO_DAY_RUNBOOK.md`'s pre-demo network test has actually been run on the real venue's network, not assumed.
- [ ] Confirm the pre-recorded backup video (per that handbook's fallback plan) exists and is genuinely current — not recorded before Session 34's calibration, which would show the wrong model version if referenced.
- [ ] Re-read `PROJECT_CONTEXT_AND_HISTORY.md` once, out loud, as viva preparation — it was written specifically to make the real arc legible without re-reading 66 Decisions Log entries cold.

## Verification Steps

**Step 1:** Rehearse the script above, timed, at least twice.

**Step 2:** Confirm `demo-mode.ts`'s five narration points still accurately describe what each page actually shows — a lot has been built since the elevation vision first sketched this; re-verify it matches the real, final app, not the original concept.

## Known open items — the honest, final list, carried forward rather than hidden at the finish line
🔴 SD buffer reporting (Session 22) — never fully implemented, sends an honest 0.
🔴 Per-sensor live calibration status (Session 22) — no data source, flagged in the UI.
🔴 Notification delivery infrastructure (Session 24, `DEC-049`) — preferences store correctly, nothing sends yet.
🔴 Units/theme settings (Session 25) — stored, not yet wired to real display behavior.

**These are named here, at the very last file, on purpose — a project that reaches its final session with an honest list of exactly what remains open is a stronger, more defensible thing to present than one that quietly implies everything is finished.**
