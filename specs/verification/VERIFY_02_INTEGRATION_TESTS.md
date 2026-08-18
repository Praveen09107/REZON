# VERIFY_02 — Integration Test Requirements
**Cross-component tests — confirming two real, independently-built pieces actually work together, not just individually. Per `METHODOLOGY.md`'s verification philosophy: live systems over static reading — every test here hits a real endpoint or real hardware, never mocked.**

| # | Test | What it actually proves |
|---|---|---|
| 1 | Device → `/ingest` round trip | A real device (or a script simulating its exact payload shape) submits real data, confirm it lands in the real `telemetry` table — not that the code *should* work |
| 2 | Duplicate submission under real network retry | Deliberately submit the same `seq_number` twice over a real HTTP call (not two function calls in the same test) → confirm exactly one row exists |
| 3 | Local pull → TimescaleDB | Real data in Supabase → run `pull_telemetry_from_cloud()` → confirm it appears in local TimescaleDB with correct values, not just "no error thrown" |
| 4 | Summary push → public status page | Local script pushes a real summary row → confirm the public `/status` page's query actually reflects it |
| 5 | Full OTA round trip | Publish a real (small, test) model to Supabase Storage → confirm device downloads, checksums, dry-run loads, and swaps — **and separately, deliberately corrupt the checksum once** to confirm the device correctly rejects it and stays on the prior model |
| 6 | RLS write-bypass via service role | Confirm the Edge Function's write path genuinely succeeds via service role even with RLS active — this is the "unusual" pattern (Backend §2) most likely to be misconfigured, worth its own explicit real test |
| 7 | Drift → retrain → OTA, end to end | Seed a real (or realistically constructed) distribution shift, confirm the *entire* Workflow C chain (Integration Spec §4) fires correctly without manual intervention at any step |

**This list is intentionally short and load-bearing** — each test proves a real cross-boundary claim this project has made somewhere (a schema contract, a safety property, a workflow), not generic "does it work" coverage.
