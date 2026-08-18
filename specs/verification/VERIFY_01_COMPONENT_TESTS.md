# VERIFY_01 — Component (Unit) Test Requirements
**Expands `TESTING_STRATEGY.md` §2-6 into concrete, enumerated test cases per component. A build-type session is not complete until the tests listed for its scope exist and pass — this is the literal checklist `/rezon-verify` checks against.**

## Firmware (Unity, host-based)
| Component | Required test cases |
|---|---|
| Fusion scoring (AI/ML §7.1-7.3) | Normalization at z=0 → 0.5; z=+5 → ~1.0; z=-5 → ~0.0; fused_score with known inputs matches hand-calculated expected value |
| Corroboration logic (AI/ML §7.4) | Exactly 1 modality elevated → no candidate; exactly 2 → candidate; current's ×1.5 boost changes outcome in a constructed edge case |
| ACS712 filter (AI/ML §5) | Known noisy input sequence → filtered output within expected smoothing bounds |
| MQ135 compensation (AI/ML §4) | Known temp/humidity inputs → output matches the linear formula's hand-calculated result |
| Actuation state machine (Firmware §5) | Every state transition exercised at least once; BURN_IN mode confirmed to make CANDIDATE unreachable (the DEC-019/020 fix — this test specifically proves the safety gate works, not just that the code compiles) |
| Idempotency sequence counter (Firmware §7) | Reboot simulation confirms counter resumes above any prior value, never resets to 0 |

## AI/ML training pipeline (pytest)
| Component | Required test cases |
|---|---|
| Held-out split (AI/ML §9) | Confirms split is by source/session, not random-frame — no data point appears in both train and held-out sets |
| Score normalization (AI/ML §7.1) | Same sigmoid test as firmware, cross-checked for identical behavior between the Python training-side implementation and the C on-device implementation |

## Backend (Deno/TypeScript, against a test Supabase project)
| Component | Required test cases |
|---|---|
| `/ingest` idempotency | Same `seq_number` submitted twice → only one row exists |
| RLS read policies | A `viewer`-role session cannot write to `anomaly_events.human_label`; an `operator`-role session can |
| `/ingest-summary` UPSERT | Same `(device_id, period_start, granularity)` submitted twice → one row, latest values |

## Local MLOps (pytest)
| Component | Required test cases |
|---|---|
| Drift check (Local MLOps §3) | Constructed distribution shift → PSI > 0.2 correctly triggers; no shift → PSI < 0.2 correctly doesn't |
| Promotion gate (Local MLOps §2) | Model with AUC below 0.85 → stays Staging, Blocker Report raised, not silently promoted |

## Frontend (Vitest)
| Component | Required test cases |
|---|---|
| Resilience states (Frontend §10) | Stale-data banner renders at >60s, connection-lost state at >5min, skeleton on first load |
| Score-to-color mapping (Frontend §2) | Score 0.5 → calm color, 0.8 → elevated, 0.9 → danger |
