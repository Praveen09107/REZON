# REZON — Blocker Report Template
**Used whenever a spec's assumption doesn't match reality (code, hardware, an external service) and the discrepancy is architecture-level, not a trivial local fix. Do not silently pick the "most reasonable" interpretation and proceed — stop and produce this report.**

```markdown
## Blocker Report — <Session/Task>

### 1. What was attempted, in order
<Real, specific sequence of steps taken>

### 2. The exact discrepancy found
<Real spec content vs. real observed content (code, hardware behavior, API
response) — quoted/described precisely, not summarized>

### 3. What was already ruled out
<E.g., "not a wiring issue — confirmed continuity with a multimeter,"
"not a stale library version — confirmed via live docs check">

### 4. Best guess at cause (explicitly labeled as a guess)
<Reasoning, clearly flagged as speculation, never asserted as settled fact>

### 5. Does this touch a safety-critical section (ADD §9 / §11 / §12.2)?
<YES/NO. If YES, this requires explicit developer sign-off per
METHODOLOGY.md §3 before proceeding on any resolution — do not treat
this as a routine reality-diverged-from-plan finding.>

### What I need from you:
<A specific, answerable question with the real trade-off named —
not "what should I do?">
```

**The rule this exists to protect:** an agent's own confidence that it picked the right interpretation is not evidence that it did. When in doubt, this report — not a silent adaptation — is the correct output of a session.
