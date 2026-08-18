# Phase A — Precision & Consistency Audit
**A.1 cross-consistency + A.2 implementability, run against the frozen ADD and every artifact produced since.**

---

## HEADLINE FINDING — requires your decision before Phase B (not resolved here)

**The frontend prototype's "Analytics" zone (7-day trend, hour×day heatmap, modality attribution) may not be servable from the architecture as frozen.**

Trace the data flow as the ADD actually specifies it: telemetry flows **device → Supabase (cloud, thin, recent-only) → local tier (pull, one-directional)**. Nothing flows back from local to cloud (§15.1: *"No bidirectional sync exists, by design"*). The cloud tier is explicitly scoped as *"recent-and-relational, not full-history"* (§13.2), while the deep historical archive — hypertables, compression, continuous aggregates, the actual multi-day trend data — lives **only** in the local, Tailscale-private TimescaleDB (§14.2).

But the public frontend (§17, and the prototype I built from it) shows a 7-day trend and a heatmap in the **public, always-on Analytics zone** — which, per the architecture, can only ever query the cloud tier, since the local tier isn't reachable by the public app at all. If the cloud tier only holds "recent" data and never receives anything back from local, **there may be nothing for that public Analytics view to actually query.**

This is a real gap, not a nitpick — it's exactly the kind of thing your own AEGIS history warns about (two independently-correct-looking pieces of work — the cloud/local split design and the frontend design — that were never checked against each other end-to-end).

**Three ways to resolve it, not resolved here on purpose:**
1. **Add a scoped reverse channel** — local tier periodically pushes *summarized* (not raw) aggregates back to a small cloud table, specifically to serve the public Analytics view. Keeps the "thin cloud" principle intact (summaries, not full history) but adds a new one-directional-the-other-way flow the ADD doesn't currently describe.
2. **Re-scope the public Analytics zone** to only show what a recent-window cloud DB can genuinely serve (e.g., last 24-48h trend, not 7 days) — deep historical analysis stays exclusively in the private Grafana view, as the architecture currently implies.
3. **Widen the cloud tier's retention window** deliberately (still plain Postgres, no Timescale features, just a longer recent-window) if Supabase's free-tier storage genuinely allows it — cheapest to implement, but quietly drifts from the "thin cloud" principle if not done deliberately.

I'm not picking one — this is a real product-experience decision (how much "shine" the public Analytics view needs) crossed with an architecture decision (does one-directional flow stay strictly one-directional). Flag your choice and it becomes a Decisions Log entry before Phase B's Backend/Frontend specs get written, since both specs depend on the answer.

---

## A.1 — Cross-consistency findings

| # | Finding | Source of contradiction | Severity |
|---|---|---|---|
| 1 | **See headline finding above** | Frontend prototype vs. ADD §13.2/§15.1 | High — blocks Backend + Frontend specs |
| 2 | The frontend prototype displays specific threshold values (alert = 0.60, response = 0.80) as if decided | These numbers do not exist anywhere in the frozen ADD — I invented them for the mockup and never flagged it at the time | Medium — corrected below in Parameter Registry, no design impact, but worth naming honestly per your own methodology's "say so plainly when you find your own mistake" rule |
| 3 | `SESSION_01`'s task list references `PIN_MAPPING.md` as a required output | Consistent with ADD §7.6 ("a concrete pin-mapping table is the first artifact the implementation should produce") | None — confirmed consistent, no action |
| 4 | `BUILD_ROADMAP.md` Phase 1 (Days 7-9) references an "IDNN-vs-AE A/B on a genuine held-out split" | Consistent with ADD §9.2's hypothesis-not-fact framing | None — confirmed consistent, but the split methodology itself is undefined (see Parameter Registry #11) |
| 5 | `CLAUDE.md`'s "Architecture facts" section states ACS712 filtering and MQ135 compensation as mandatory | Consistent with ADD §7.3/§9.4 | None — confirmed consistent, but exact parameters undefined (Registry #13-14) |
| 6 | `DEC-001`'s three deviations (safety carve-out, hardware verification, timeline phasing) | Checked against `METHODOLOGY.md` §3-5 — all three are represented accurately, no drift between the decision and its documented implementation | None — confirmed consistent |

## A.2 — Section-by-section implementability audit

Every ADD section, checked against one question: *could a precise algorithm/schema/state machine be written from this section alone?*

| ADD § | Section | Implementable as-is? | Gap (if any) |
|---|---|---|---|
| 1-2 | Doc control, glossary | N/A (meta) | — |
| 3 | Assumptions & constraints | N/A (qualitative, correctly so) | — |
| 4 | NFRs | **Partial** | NFR-4 ("single-digit seconds") needs an exact bound to be testable — see Registry #19 |
| 5-6 | Context, principles | N/A (narrative, correctly so) | — |
| 7 | Hardware | **Partial** | Pin mapping (already OPEN-02), MQ135 divider resistor values, ACS712 filter params (Registry #7, #13) |
| 8 | Firmware/RTOS | **Partial** | Task priority numbers, stack sizes, inter-task communication mechanism (queue vs. shared-mem+mutex) not specified |
| 9 | AI/ML | **No — the largest gap in the whole ADD** | Spectrogram params, IDNN context window, vibration band boundaries, initial/cold-start fusion weights, per-modality thresholds, held-out AUC bar, split methodology — see Registry #1-3, #8-11, #12 |
| 10 | Training pipeline | **Partial** | Burn-in duration decision rule (1 vs 2 weeks — what decides) |
| 11 | Actuation & safety | **No — the second-largest gap, and safety-critical** | Debounce duration, cooldown duration both qualitative only ("a few seconds," "minimum interval") — see Registry #5-6 |
| 12 | Communication/transport | **Partial** | Idempotency sequence-number persistence/wraparound behavior undefined — real correctness risk if unresolved (Registry #16) |
| 13 | Cloud architecture | **No** | Table schema, RLS predicate not specified (Registry #22-23) |
| 14 | Local/MLOps tier | **Partial** | Retention window bound, continuous-aggregate field mapping (Registry #17-18) |
| 15 | Data & storage | **No** | Ties to 13 — conceptual only |
| 16 | Security | **Yes** | Roles are clear enough to implement directly |
| 17 | Frontend/UX | **Partial** | Component/API-contract level detail needed, plus the headline finding above |
| 18 | Observability | **Yes**, mostly | Minor: log format not specified, low priority |
| 19 | Workflows | **Yes** as narrative | Needs to be rewritten in Phase B.6 referencing real function/endpoint names once they exist |
| 20-25 | Failure modes, scalability, risk, decisions, out-of-scope, appendices | N/A / Yes | No implementability gap |

**Net result: 2 sections (AI/ML, Actuation & Safety) carry the most significant gaps — both are exactly the sections under the safety-critical carve-out, meaning Phase B's work on them will need explicit sign-off per `METHODOLOGY.md` §3, not just competent engineering.**
