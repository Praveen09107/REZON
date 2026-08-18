# REZON

**Privacy-preserving, multimodal edge-AI anomaly monitoring platform.** ESP32-S3-based device, 5 sensing modalities, on-device inference, autonomous safety-gated actuation, Supabase cloud tier, self-hosted local MLOps tier, Next.js frontend.

Solo capstone project. Design-frozen architecture, implementation in progress.

## Quick facts

- **Hardware:** ESP32-S3-WROOM-1 N16R8 + INMP441 (audio) + MPU-6050/SW-420 (vibration) + DHT22/BMP280 (environment) + MQ135 (gas) + ACS712 (current) + relay + physical override switch
- **On-device AI:** IDNN (audio, trained), self-calibrating statistical monitors (vibration/environment/gas/current, no training required)
- **Cloud:** Supabase (DB + Auth + Storage + Edge Functions), Vercel (frontend)
- **Local:** Docker Compose — TimescaleDB, MLflow, Evidently, Grafana
- **Methodology:** spec-driven, AEGIS-adapted, Claude Code as implementation agent

## Start here

New to this repo? Read in this order:
1. `GETTING_STARTED.md` — how to actually set this up and run your first session
2. `PROJECT_CONTEXT_AND_HISTORY.md` — the full story of how this architecture came to be
3. `specs/verification/STATUS.md` — what's actually true right now
4. `.claude/CLAUDE.md` — the operating contract every session reads automatically

## Repository structure

```
.claude/CLAUDE.md          — always-loaded operating contract
specs/foundation/          — the frozen architecture (ADD) + amendments
specs/technical/           — exact algorithms, schemas, state machines (6 docs)
specs/verification/        — decisions log, status, testing strategy, audits
specs/methodology/         — how sessions work, git conventions, slash commands
specs/sessions/            — per-session implementation specs
specs/frontend-research/   — the frontend elevation vision and design direction
```

## Current status

Check `specs/verification/STATUS.md` — this file is stable reference, that one changes every session.

## License / academic note

Capstone project. Not licensed for reuse without permission.
