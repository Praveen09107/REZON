# REZON — Project Context & History
**The real story, for anyone (including a fresh Claude Code session) who needs to understand not just what REZON is, but how it got this way and why the decisions were made in this order.**

---

## 1. What REZON is, and the philosophy underneath it

REZON watches a physical space and one machine within it, learns what "normal" looks like specifically for that environment, detects deviations across five independent sensing channels, and can autonomously cut power to the machine when evidence is strong enough — without ever transmitting privacy-sensitive raw data off the device. Three principles run through every decision documented in this repo: a thin, smart edge that never depends on the cloud to make a real-time decision; honest tiering, where the cloud and local machine each own a distinct permanent job rather than pretending to be one system; and right-sizing over impressiveness — every component earns its place at REZON's actual scale, not a scale it doesn't have.

## 2. The architecture phase — six adversarial reviews, not one

The Architecture Design Document (`specs/foundation/REZON_ADD.md`) wasn't written once and frozen — it survived six independent, genuinely adversarial review passes, each looking for reasons the design was wrong rather than confirming it was right. Real reversals happened along the way, not just refinements: MQTT was dropped in favor of direct HTTPS once the actual scale (one device, modest message rate) was honestly assessed. Oracle Cloud was dropped as a dependency after proving unreliable in practice, replaced by Supabase as a single consolidated cloud vendor. The cloud vendor count was actively cut from five candidates down to two. Each reversal is preserved in the ADD's own §23 decision log, specifically so the reasoning survives, not just the conclusion.

## 3. The AEGIS methodology adaptation

The implementation methodology isn't invented from scratch — it's adapted from a real prior solo project (AEGIS, a production SAP helpdesk AI), with three deliberate deviations made because REZON is genuinely different in kind: a **safety-critical sign-off carve-out** (living verification doesn't silently override the frozen plan for actuation logic — a human confirms), a **hardware-verification extension** (a physical claim needs a logged physical observation, not just code that compiles), and a **timeline-engineered build sequence** (the field-calibration burn-in is calendar time, not work time, so later phases parallelize around it rather than waiting for it).

## 4. Phase A/B — the precision audit and technical depth

A dedicated audit (Phase A) found that "architecturally sound" and "precise enough to implement" are different bars — the frozen ADD contained 26 real qualitative gaps that needed to become exact numbers, formulas, and schemas before anything could be built correctly. Phase B closed all 26, across six technical specifications, each value carrying an explicit confidence marker (🟢 standard practice, 🟡 reasoned default, 🔴 genuinely unknown until real hardware data exists) rather than false uniform certainty.

**A later quality audit, requested explicitly rather than assumed unnecessary, found three more real gaps** even after Phase B was declared complete: environment's anomaly-scoring algorithm had never been defined despite being summed into the fusion formula; the burn-in period's actuation-disabled requirement was never actually enforced in the firmware state machine (the single most safety-relevant find in the whole process); and no OTA state machine existed despite the ADD describing OTA's safety properties narratively. All three are closed, logged with full transparency — including a documented case where the first attempted fix went the wrong direction and was caught and reversed through further verification, not smoothed over.

## 5. The frontend elevation

The frontend was identified, honestly, as the weakest part of the project relative to the sophistication of everything behind it — a well-organized dashboard with REZON's data poured into it, not a product built around what REZON specifically is. Real research (current 2026 AI-native UX practice, industrial IoT digital-twin conventions, explainable-AI trust patterns) informed a genuine redesign: a live digital-twin home screen replacing an abstract card grid, the actuation safety chain made visually explicit rather than hidden behind a toggle, and a 19-page sitemap where every addition traces to a real, named gap rather than padding.

## 6. Where the real trust comes from

Every major finding in this project's history — the reversed decisions, the caught mistakes, the honestly-flagged unknowns — is preserved in `specs/verification/DECISIONS_LOG.md`, not smoothed over in a final polished version that hides how the answer was actually reached. That log, not this narrative, is the authoritative record; this document exists to make the shape of that history legible without reading all ~20 entries cold.
