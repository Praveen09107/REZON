# REZON — Hardware Verification Log
**The physical-evidence companion to DECISIONS_LOG.md. A hardware-touching session is not complete without an entry here. Code correctness is not evidence for this file — a physical observation is.**

**Rules:**
1. Append-only, numbered `HW-001`, `HW-002`, ... — same discipline as the Decisions Log.
2. Every entry states exactly what was physically observed, how, and — where relevant — the actual reading/value seen, not "should be working."
3. If a physical check fails or is inconclusive, log that too, plainly, with what was tried. A failed check recorded honestly is valuable; a skipped one is not.
4. Where a claim can't be physically verified yet (component not yet arrived, session ran out of time), say so explicitly rather than leaving a gap that later reads as "presumably fine."

**Entry template:**
```markdown
### HW-XXX — <specific component/circuit being verified>

**What was checked:** <exact test performed>
**Method:** <multimeter / serial monitor / captured sample / visual observation / etc.>
**Result:** <the actual value/observation, not an inference>
**Verdict:** PASS | FAIL | INCONCLUSIVE — <why>
**Affects:** <which session/spec this verifies>
```

---

## Entries

*(Empty — populated starting with the first hardware-touching session in Phase 1.)*
