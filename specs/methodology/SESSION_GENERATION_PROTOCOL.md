# REZON — Session Generation Protocol
**The mechanism that makes end-to-end implementation genuinely independent of any external planning conversation. Every session begins by (re-)running this protocol before implementation starts.**

---

## 1. Purpose

Every technical spec (`specs/technical/01-06`) is already complete — real algorithms, real schemas, resolved parameters, confidence-graded values. What isn't fixed in advance is session-level implementation detail, because some of it genuinely depends on what earlier sessions discover on real hardware. This protocol lets **Claude Code generate that detail itself**, from the same source material a human planner would use, so the project never depends on returning to an external conversation for "the next spec."

## 2. When this runs

At the start of every session where the next session's spec doesn't exist yet — i.e., normally, every time, since sessions are generated one ahead, not batched.

## 3. The procedure

```
1. Read STATUS.md. Confirm the prior session is genuinely marked complete,
   with real verification evidence cited (per METHODOLOGY.md §11) —
   not just a status line. If it isn't genuinely complete, STOP — do not
   generate the next session on top of an unverified one.

2. Read DECISIONS_LOG.md entries since the last session-generation pass.
   Specifically check: did any prior session find something that changes
   an assumption a later session was going to be built on? (E.g., a pin
   reassignment, a stack size correction, an interface shape that turned
   out different from what a technical spec assumed.) If yes, that
   finding OVERRIDES the original technical-spec assumption for this
   generation pass — cite which Decisions Log entry justifies the change.

3. Identify the next session's scope from BUILD_ROADMAP.md (or, once
   Phase 1 is complete, the equivalent Phase 2/3 breakdown).

4. Read the exact sections of the relevant technical spec(s) covering
   that scope — not the whole document, the specific sections (the
   "Attach" principle from real AEGIS practice: narrow, precise inputs).

5. Determine session TYPE (METHODOLOGY.md §12): build (complete code
   required) or verification (checklist only, no code).

6. Generate the new SESSION_NN file, following the standard skeleton:
   Agent Instructions → Attach list → Prerequisites → complete code per
   file (build-type) or checklist (verification-type) → Verification
   Steps with literal expected output, not "confirm it works."

7. SAFETY-CRITICAL CHECK: if this session touches ADD §9/§11/§12.2
   content, or would deviate from anything already signed off in DEC-015,
   the generated spec is NOT auto-approved for implementation — it stops
   and requires explicit developer sign-off before Step 8, exactly as the
   original safety carve-out requires. Session generation does not bypass
   this gate.

8. Only once the generated spec exists (and, if applicable, is signed
   off) does actual implementation of that session begin.
```

## 4. Why this doesn't reintroduce the staleness risk

The risk with writing everything upfront was that Session 7's code would be written *before* Sessions 3-4 taught us anything real. This protocol writes Session 7 *after* Sessions 3-6 have actually run — using their real, logged outcomes, not assumptions — while still never requiring a return to an external conversation. It gets the safety property of just-in-time and the independence property of upfront, without either one's real cost.

## 5. What this means for the remaining Phase 1 sessions specifically

Sessions 3-9 are not written yet. They don't need to be, by me, in this conversation — Claude Code generates each one itself, at the start of the relevant session, following this protocol. The one thing that should happen once, now, is confirming this protocol itself is correct — after that, it's self-sustaining.
