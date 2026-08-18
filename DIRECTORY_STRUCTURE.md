# REZON — Canonical Directory Structure

## Complete Tree

```
rezon/
├── .github/
│   └── workflows/
│       ├── frontend-ci.yml
│       └── firmware-build.yml
│
├── .claude/
│   └── CLAUDE.md                          (exists)
│
├── firmware/
│   ├── main/
│   │   ├── main.c
│   │   ├── tasks/
│   │   │   ├── sensor_acquisition.c/h     (Session 3)
│   │   │   ├── feature_extraction.c/h     (Session 4)
│   │   │   ├── inference_fusion.c/h       (Session 7)
│   │   │   ├── networking.c/h             (Session 8)
│   │   │   └── output_actuation.c/h       (Session 7)
│   │   ├── sensors/
│   │   │   ├── inmp441.c/h                (Session 3 — I2S audio)
│   │   │   ├── mpu6050.c/h                (Session 3 — I2C vibration)
│   │   │   ├── bmp280.c/h                 (Session 3 — I2C pressure/temp)
│   │   │   ├── dht22.c/h                  (Session 3 — single-wire humidity)
│   │   │   ├── mq135.c/h                  (Session 3 — ADC gas)
│   │   │   ├── acs712.c/h                 (Session 3 — ADC current)
│   │   │   └── sw420.c/h                  (Session 3 — vibration corroboration)
│   │   ├── ai/
│   │   │   ├── model_runner.cc/h          (Session 6 — TFLite Micro wrapper)
│   │   │   └── idnn_model.cc              (Session 6 — generated model bytes)
│   │   ├── fusion/
│   │   │   ├── rolling_stats.c/h          (Session 4 — Welford's algorithm)
│   │   │   ├── fusion.c/h                 (Session 7 — fusion formula + normalization)
│   │   │   └── actuation_sm.c/h           (Session 7 — BOOT_SAFE/MONITORING/CANDIDATE/COOLDOWN)
│   │   ├── networking/
│   │   │   ├── wifi_manager.c/h           (Session 8)
│   │   │   ├── supabase_client.c/h        (Session 8 — HTTPS POST /ingest)
│   │   │   └── ota_sm.c/h                 (Session 8 — IDLE/DOWNLOADING/VERIFYING/DRY_RUN/SWAPPING)
│   │   ├── storage/
│   │   │   ├── nvs_store.c/h              (Session 8 — seq counter, mode, checkpoints)
│   │   │   └── sd_buffer.c/h              (Session 9)
│   │   └── shared/
│   │       ├── config.h                   (CREATE NOW — all constants)
│   │       ├── types.h                    (CREATE NOW — shared structs)
│   │       ├── shared_queues.c            (Session 3)
│   │       └── shared_queues.h            (Session 3)
│   ├── test/                              (Unity host-based — run on dev machine)
│   │   ├── test_fusion.c                  (Session 7)
│   │   ├── test_actuation_sm.c            (Session 7)
│   │   ├── test_rolling_stats.c           (Session 4)
│   │   └── CMakeLists.txt
│   ├── CMakeLists.txt                     (CREATE NOW)
│   ├── sdkconfig.defaults                 (CREATE NOW)
│   └── partitions.csv                     (CREATE NOW — dual OTA layout)
│
├── supabase/
│   ├── migrations/
│   │   └── 20260818000000_initial_schema.sql   (CREATE NOW — full schema from Backend Spec §1)
│   ├── functions/
│   │   ├── ingest/
│   │   │   └── index.ts                   (Session 33)
│   │   ├── models-latest/
│   │   │   └── index.ts                   (Session 33)
│   │   └── ingest-summary/
│   │       └── index.ts                   (Session 33)
│   ├── seed.sql                           (Session 33)
│   └── config.toml                        (CREATE NOW)
│
├── frontend/                              (scaffolded by create-next-app in Session 10)
│   ├── app/
│   │   ├── layout.tsx                     (Session 11)
│   │   ├── login/
│   │   │   └── page.tsx                   (Session 11)
│   │   ├── status/                        (public no-auth, separate layout)
│   │   │   ├── layout.tsx                 (Session 26)
│   │   │   └── page.tsx                   (Session 26)
│   │   └── (app)/                         (auth-required, sidebar layout)
│   │       ├── layout.tsx                 (Session 12)
│   │       ├── page.tsx                   (Home / Session 14)
│   │       ├── streams/page.tsx           (Session 15)
│   │       ├── incidents/
│   │       │   ├── page.tsx               (Session 16)
│   │       │   └── [id]/page.tsx          (Session 16)
│   │       ├── safety-chain/page.tsx      (Session 17)
│   │       ├── timeline/page.tsx          (Session 15)
│   │       ├── analytics/page.tsx         (Session 18)
│   │       ├── model/page.tsx             (Session 18)
│   │       ├── since-calibration/page.tsx (Session 19)
│   │       ├── sandbox/page.tsx           (Session 20)
│   │       ├── digest/page.tsx            (Session 19)
│   │       ├── trust-audit/page.tsx       (Session 21)
│   │       ├── device/page.tsx            (Session 22)
│   │       ├── calibration/page.tsx       (Session 22)
│   │       ├── deployments/page.tsx       (Session 23)
│   │       ├── notifications/page.tsx     (Session 24)
│   │       ├── access/page.tsx            (Session 24)
│   │       ├── settings/page.tsx          (Session 25)
│   │       └── help/page.tsx              (Session 25)
│   ├── components/
│   │   ├── ui/                            (shadcn/ui generated — Session 10)
│   │   ├── layout/                        (sidebar, topbar, command palette — Session 12)
│   │   ├── charts/                        (recharts wrappers — Session 18)
│   │   ├── sensors/                       (pulse points, sensor cards — Session 14)
│   │   ├── safety/                        (safety chain visualization — Session 17)
│   │   └── common/                        (score badges, resilience wrapper — Sessions 12-13)
│   ├── hooks/
│   │   ├── use-live-telemetry.ts          (Session 13 — Realtime subscription)
│   │   ├── use-polled-query.ts            (Session 13 — 15-30s interval)
│   │   └── use-static-query.ts            (Session 13 — fetch-once)
│   ├── lib/
│   │   ├── supabase/
│   │   │   ├── client.ts                  (Session 11 — browser client)
│   │   │   ├── server.ts                  (Session 11 — server component client)
│   │   │   └── middleware.ts              (Session 11)
│   │   ├── score-utils.ts                 (Session 10 — score→color, threshold logic)
│   │   └── utils.ts
│   ├── types/
│   │   ├── database.ts                    (generated from supabase schema)
│   │   └── rezon.ts                       (app-level types)
│   └── public/
│
├── local-mlops/
│   ├── docker-compose.yml                 (CREATE NOW)
│   ├── .env.example                       (CREATE NOW)
│   ├── timescaledb/
│   │   └── init/
│   │       ├── 01_schema.sql              (Session 29 — hypertable + continuous aggregates)
│   │       └── 02_seed.sql
│   ├── grafana/
│   │   ├── provisioning/
│   │   │   ├── datasources/
│   │   │   │   └── timescaledb.yml        (Session 32)
│   │   │   └── dashboards/
│   │   │       └── rezon.yml              (Session 32)
│   │   └── dashboards/
│   │       └── rezon_overview.json        (Session 32)
│   ├── mlflow/                            (volume mount only, nothing tracked)
│   └── scripts/
│       ├── scheduled_run.py               (Session 31)
│       ├── data_operations.py             (Session 31 — DEC-069 fix)
│       ├── requirements.txt               (CREATE NOW)
│       └── .env.example                   (CREATE NOW)
│
├── training/
│   ├── data/                              (.gitignored — actual audio/sensor files)
│   │   ├── raw/
│   │   ├── processed/
│   │   └── held_out/
│   ├── models/                            (.gitignored — large model artifacts)
│   │   ├── float32/
│   │   └── int8/
│   ├── src/
│   │   ├── __init__.py
│   │   ├── features.py                    (Session 5 — MUST match firmware C bit-for-bit)
│   │   ├── model.py                       (Session 5 — IDNN architecture)
│   │   ├── augment.py                     (Session 5 — SpecAugment, mixup, RIR)
│   │   ├── train.py                       (Session 5 — Stage 1+2 training)
│   │   ├── qat.py                         (Session 6 — QAT + INT8 conversion)
│   │   ├── evaluate.py                    (Session 6 — held-out AUC gate)
│   │   └── export.py                      (Session 6 — TFLite export + embed as C array)
│   ├── tests/
│   │   ├── __init__.py
│   │   ├── test_features.py
│   │   ├── test_augment.py
│   │   └── test_evaluate.py
│   ├── requirements.txt                   (CREATE NOW)
│   └── README.md                          (CREATE NOW — critical warning about features.py)
│
├── specs/                                 (exists — 79 files, DO NOT restructure)
│   ├── foundation/
│   ├── technical/
│   ├── sessions/
│   ├── verification/
│   ├── methodology/
│   └── frontend-research/
│
├── handbook/                              (exists)
│
├── .gitignore                             (CREATE NOW)
├── .gitattributes                         (CREATE NOW — LF for C files on Windows)
├── README.md                              (exists)
├── GETTING_STARTED.md                     (exists)
├── FINAL_TECH_STACK.md                    (exists)
├── PROJECT_CONTEXT_AND_HISTORY.md        (exists)
├── CONTRIBUTING.md                        (exists)
└── DIRECTORY_STRUCTURE.md                (this file)
```

## Files to Create Now vs Later

### Create Now (scaffold + config — no implementation)
- `firmware/CMakeLists.txt`
- `firmware/sdkconfig.defaults`
- `firmware/partitions.csv`
- `firmware/main/shared/config.h` — constants shell only
- `firmware/main/shared/types.h` — struct shell only
- `supabase/config.toml`
- `supabase/migrations/20260818000000_initial_schema.sql` — full schema from Backend Spec §1
- `local-mlops/docker-compose.yml` — service definitions, volumes
- `local-mlops/.env.example`
- `local-mlops/scripts/requirements.txt`
- `local-mlops/scripts/.env.example`
- `training/requirements.txt`
- `training/README.md`
- `training/src/__init__.py`
- `training/tests/__init__.py`
- `.gitignore`
- `.gitattributes`

### Created During Sessions (real implementation code)
- All `.c/.h` firmware files — Sessions 3-9
- All Next.js components and pages — Sessions 10-27
- All Python training scripts — Sessions 5-6
- All MLOps scripts — Sessions 29-32
- All Supabase Edge Functions — Session 33
- All Grafana dashboards — Session 32

## Key Structural Decisions

| Decision | Reason |
|---|---|
| Monorepo | Cross-component changes visible in one commit; solo project, no workspace overhead needed |
| `supabase/` follows Supabase CLI layout | `supabase db push` and `supabase functions deploy` work from day one |
| `firmware/main/` mirrors RTOS task structure | AI agent navigates by task name, not file type |
| `training/` separate from `local-mlops/` | Training = periodic GPU job; MLOps = always-running stack |
| `features.py` must mirror C implementation | Silent mismatch = model trained on different features than it runs on |
| `specs/` untouched at root | Every session spec references these paths — never move |
| Route groups `(app)/` in Next.js | Parenthetical dirs don't affect URLs; logically groups auth-required routes |
