# VERIFY_03 — Architectural Compliance Checklist
**Does the built system actually match the frozen ADD and technical specs — not "does it work," but "is it still the architecture we designed." This is the literal checklist for the two scheduled audits (mid-Phase-1, end-of-Phase-3, per `DEC-013`).**

## Cloud tier stays thin (ADD §13)
- [x] No TimescaleDB extension enabled on the Supabase project — plain Postgres only
- [x] `telemetry` table has an active 30-day retention policy (Backend §5), not unbounded growth
- [x] No second cloud database vendor introduced

## Local tier has the real depth (ADD §14)
- [x] TimescaleDB hypertables + continuous aggregates genuinely active (not just plain tables)
- [x] MLflow tracking every training run, not just the final promoted model
- [x] Scheduled script remains a single script — no orchestrator (Airflow/Prefect) introduced

## Transport (ADD §12)
- [x] Device uses direct HTTPS — no MQTT broker present anywhere in the stack
- [x] Every device submission carries a `seq_number`; server enforces `UNIQUE(device_id, seq_number)`

## Security (ADD §16)
- [x] Grafana, MLflow, local database are NOT publicly reachable — Tailscale-only
- [x] Public frontend has real Supabase Auth, not a hardcoded/bypassed check
- [ ] Secure Boot / Flash Encryption NOT enabled on the production device (deferred per ADD §16, only ever prototyped on a spare board)

## Actuation safety (ADD §11) — the highest-priority section of this checklist
- [x] 2-of-5 corroboration genuinely gates actuation, confirmed by a real test (not just present in code)
- [ ] Debounce (4 cycles) and cooldown (60s) values match the signed-off Firmware Spec §3
- [ ] Physical override switch wired in series with the relay's load side, NOT to any GPIO — confirmed by physical inspection, not code review
- [x] BURN_IN mode confirmed to make actuation structurally unreachable (DEC-019/020) — re-verified here, not just trusted from the original test

## AI pipeline (ADD §9)
- [x] All 5 modalities genuinely scored (environment included, per DEC-017 — confirm `env_score` is actually populated in real telemetry rows, not just present in the schema)
- [x] Held-out AUC ≥ 0.85 confirmed on the actual trained model, not assumed from the spec's target
- [x] QAT actually used (not plain post-training quantization) — confirm via the training script's real procedure, not its docstring

## Data durability (ADD §15)
- [x] Device SD buffer, Supabase, and local TimescaleDB all genuinely hold recent data — the three-copy design confirmed present, not just designed
