Set-Location 'D:\Program Files\rezon_test'

function New-Dir($p) { New-Item -ItemType Directory -Force -Path $p | Out-Null }
function New-File($p, $c = '') {
    if (-not (Test-Path $p)) {
        New-Item -ItemType File -Force -Path $p | Out-Null
        if ($c) { Set-Content -Path $p -Value $c -Encoding UTF8 }
    }
}

# ── .github ────────────────────────────────────────────────────────────────
New-Dir '.github/workflows'
New-File '.github/workflows/frontend-ci.yml' '# Frontend CI — implemented in Session 10'
New-File '.github/workflows/firmware-build.yml' '# Firmware build check — implemented in Session 3'

# ── Firmware ───────────────────────────────────────────────────────────────
New-Dir 'firmware/main/tasks'
New-Dir 'firmware/main/sensors'
New-Dir 'firmware/main/ai'
New-Dir 'firmware/main/fusion'
New-Dir 'firmware/main/networking'
New-Dir 'firmware/main/storage'
New-Dir 'firmware/main/shared'
New-Dir 'firmware/test'

New-File 'firmware/CMakeLists.txt' @'
cmake_minimum_required(VERSION 3.16)
include($ENV{IDF_PATH}/tools/cmake/project.cmake)
project(rezon)
'@

New-File 'firmware/sdkconfig.defaults' @'
CONFIG_IDF_TARGET="esp32s3"
CONFIG_ESP32S3_DEFAULT_CPU_FREQ_240=y
CONFIG_SPIRAM=y
CONFIG_SPIRAM_MODE_OCT=y
CONFIG_SPIRAM_SPEED_80M=y
CONFIG_PARTITION_TABLE_CUSTOM=y
CONFIG_PARTITION_TABLE_CUSTOM_FILENAME="partitions.csv"
CONFIG_ESPTOOLPY_FLASHSIZE_16MB=y
CONFIG_FREERTOS_UNICORE=n
CONFIG_FREERTOS_HZ=1000
'@

New-File 'firmware/partitions.csv' @'
# Name,   Type, SubType, Offset,   Size,     Flags
nvs,      data, nvs,     0x9000,   0x6000,
otadata,  data, ota,     0xf000,   0x2000,
phy_init, data, phy,     0x11000,  0x1000,
ota_0,    app,  ota_0,   0x20000,  0x780000,
ota_1,    app,  ota_1,   0x7a0000, 0x780000,
sdcard,   data, fat,     0xf20000, 0xC0000,
'@

New-File 'firmware/main/shared/config.h' @'
#pragma once
// REZON constants — from specs/technical/02_FIRMWARE_RTOS_TECHNICAL_SPEC.md
// Never hardcode these values elsewhere.

// Thresholds — pre-calibration defaults (AI/ML Spec §7.3)
#define ALERT_THRESHOLD          0.65f
#define RESPONSE_THRESHOLD       0.85f
#define CORROBORATION_THRESHOLD  0.75f
#define CORROBORATION_COUNT      2

// Actuation gates — safety-critical, signed off DEC-015
#define DEBOUNCE_CYCLES          4
#define COOLDOWN_SECONDS         60

// Audio (AI/ML Spec §1)
#define AUDIO_SAMPLE_RATE        16000
#define AUDIO_FFT_WINDOW         1024
#define AUDIO_HOP_SIZE           512
#define AUDIO_MEL_BINS           40
#define AUDIO_CONTEXT_FRAMES     6

// ACS712 filter (AI/ML Spec §5)
#define CURRENT_EMA_ALPHA        0.2f
'@

New-File 'firmware/main/shared/types.h' @'
#pragma once
#include <stdbool.h>
#include <stdint.h>

// Shared structs used across RTOS tasks via queues.
// Defined here so both producers and consumers see the same definition (DEC-068 fix).

typedef struct {
    float audio_score;
    float vibration_score;
    float environment_score;
    float gas_score;
    float current_score;
    float fused_score;
    float env_temp;
    float env_humidity;
    float env_pressure;
    bool  relay_active;
    bool  vibration_hw_confirmed;
} fusion_result_t;

typedef struct {
    uint32_t       seq_number;
    fusion_result_t result;
    char           event_type[32];
    uint32_t       recorded_at_unix;
    int32_t        free_heap_bytes;
    int32_t        psram_used_bytes;
    int32_t        psram_total_bytes;
    int8_t         wifi_rssi_dbm;
    int32_t        sd_buffer_minutes;
} telemetry_submission_t;

typedef enum { OPMODE_BURN_IN, OPMODE_FULL_OPERATION } operating_mode_t;
typedef enum { ASM_BOOT_SAFE, ASM_MONITORING, ASM_CANDIDATE, ASM_COOLDOWN } actuation_state_t;
'@

New-File 'firmware/test/CMakeLists.txt' '# Unity host-based tests — implemented in Sessions 4/7'

# ── Supabase ───────────────────────────────────────────────────────────────
New-Dir 'supabase/migrations'
New-Dir 'supabase/functions/ingest'
New-Dir 'supabase/functions/models-latest'
New-Dir 'supabase/functions/ingest-summary'

New-File 'supabase/config.toml' @'
project_id = "rezon"

[api]
port = 54321

[db]
port = 54322

[studio]
port = 54323

[storage]
file_size_limit = "50MiB"
'@

New-File 'supabase/migrations/20260818000000_initial_schema.sql' @'
-- REZON initial schema — specs/technical/03_BACKEND_CLOUD_TECHNICAL_SPEC.md §1
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS devices (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_secret_hash  text NOT NULL,
  firmware_version    text,
  active_model_version text,
  status              text NOT NULL DEFAULT ''provisioned'',
  created_at          timestamptz NOT NULL DEFAULT now(),
  last_seen_at        timestamptz,
  free_heap_bytes     integer,
  psram_used_bytes    integer,
  psram_total_bytes   integer,
  wifi_rssi_dbm       integer,
  sd_buffer_minutes   integer
);

CREATE TABLE IF NOT EXISTS telemetry (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id         uuid NOT NULL REFERENCES devices(id),
  seq_number        bigint NOT NULL,
  recorded_at       timestamptz NOT NULL,
  received_at       timestamptz NOT NULL DEFAULT now(),
  audio_score       real, vibration_score real, env_score real,
  gas_score         real, current_score real,
  env_temp          real, env_humidity real, env_pressure real,
  fused_score       real NOT NULL,
  UNIQUE (device_id, seq_number)
);

CREATE TABLE IF NOT EXISTS anomaly_events (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id               uuid NOT NULL REFERENCES devices(id),
  seq_number              bigint NOT NULL,
  event_type              text NOT NULL,
  recorded_at             timestamptz NOT NULL,
  fused_score             real NOT NULL,
  contributing_modalities jsonb NOT NULL,
  human_label             text,
  labeled_at              timestamptz,
  UNIQUE (device_id, seq_number)
);

CREATE TABLE IF NOT EXISTS model_registry (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version             text NOT NULL UNIQUE,
  held_out_auc        real NOT NULL,
  checksum_sha256     text NOT NULL,
  storage_path        text NOT NULL,
  status              text NOT NULL DEFAULT ''staged'',
  training_data_note  text,
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS telemetry_summary (
  device_id            uuid NOT NULL REFERENCES devices(id),
  period_start         timestamptz NOT NULL,
  granularity          text NOT NULL,
  avg_fused_score      real NOT NULL,
  max_fused_score      real NOT NULL,
  modality_attribution jsonb NOT NULL,
  event_count          int NOT NULL DEFAULT 0,
  PRIMARY KEY (device_id, period_start, granularity)
);

CREATE TABLE IF NOT EXISTS drift_status (
  device_id  uuid NOT NULL REFERENCES devices(id),
  modality   text NOT NULL,
  psi_value  real NOT NULL,
  status     text NOT NULL,
  checked_at timestamptz NOT NULL,
  PRIMARY KEY (device_id, modality)
);

CREATE TABLE IF NOT EXISTS profiles (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id),
  role    text NOT NULL DEFAULT ''viewer''
);

CREATE TABLE IF NOT EXISTS notification_preferences (
  user_id           uuid PRIMARY KEY REFERENCES auth.users(id),
  alert_threshold   real NOT NULL DEFAULT 0.65,
  quiet_hours_start smallint,
  quiet_hours_end   smallint
);

-- RLS
ALTER TABLE telemetry ENABLE ROW LEVEL SECURITY;
ALTER TABLE anomaly_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE telemetry_summary ENABLE ROW LEVEL SECURITY;
ALTER TABLE drift_status ENABLE ROW LEVEL SECURITY;

CREATE POLICY telemetry_read ON telemetry FOR SELECT USING (true);
CREATE POLICY telemetry_summary_read ON telemetry_summary FOR SELECT USING (true);
CREATE POLICY drift_status_read ON drift_status FOR SELECT USING (true);
CREATE POLICY anomaly_events_read ON anomaly_events FOR SELECT USING (true);
CREATE POLICY anomaly_events_label ON anomaly_events FOR UPDATE
  USING (EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = ''operator''));
'@

New-File 'supabase/functions/ingest/index.ts' '// POST /ingest — implemented in Session 33'
New-File 'supabase/functions/models-latest/index.ts' '// GET /models/latest — implemented in Session 33'
New-File 'supabase/functions/ingest-summary/index.ts' '// POST /ingest-summary — implemented in Session 33'
New-File 'supabase/seed.sql' '-- Test seed data — implemented in Session 33'

# ── Frontend placeholder ───────────────────────────────────────────────────
New-Dir 'frontend'
New-File 'frontend/.gitkeep' '# Scaffolded by create-next-app in Session 10. Do not add files manually.'

# ── Local MLOps ────────────────────────────────────────────────────────────
New-Dir 'local-mlops/timescaledb/init'
New-Dir 'local-mlops/grafana/provisioning/datasources'
New-Dir 'local-mlops/grafana/provisioning/dashboards'
New-Dir 'local-mlops/grafana/dashboards'
New-Dir 'local-mlops/mlflow'
New-Dir 'local-mlops/scripts'

New-File 'local-mlops/docker-compose.yml' @'
version: "3.8"
# REZON local MLOps — TimescaleDB + MLflow + Grafana
# Tailscale-only access. Never expose ports publicly.

services:
  timescaledb:
    image: timescale/timescaledb:latest-pg15
    environment:
      POSTGRES_DB: rezon
      POSTGRES_USER: ${TSDB_USER}
      POSTGRES_PASSWORD: ${TSDB_PASSWORD}
    ports:
      - "127.0.0.1:5433:5432"
    volumes:
      - tsdb_data:/var/lib/postgresql/data
      - ./timescaledb/init:/docker-entrypoint-initdb.d
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${TSDB_USER} -d rezon"]
      interval: 10s
      timeout: 5s
      retries: 5

  mlflow:
    image: ghcr.io/mlflow/mlflow:latest
    command: >
      mlflow server
      --host 0.0.0.0
      --port 5000
      --backend-store-uri postgresql://${TSDB_USER}:${TSDB_PASSWORD}@timescaledb:5432/rezon
      --default-artifact-root /mlflow/artifacts
    ports:
      - "127.0.0.1:5000:5000"
    volumes:
      - mlflow_artifacts:/mlflow/artifacts
    depends_on:
      timescaledb:
        condition: service_healthy

  grafana:
    image: grafana/grafana:latest
    environment:
      GF_SECURITY_ADMIN_PASSWORD: ${GRAFANA_PASSWORD}
      GF_USERS_ALLOW_SIGN_UP: "false"
    ports:
      - "127.0.0.1:3001:3000"
    volumes:
      - grafana_data:/var/lib/grafana
      - ./grafana/provisioning:/etc/grafana/provisioning
      - ./grafana/dashboards:/var/lib/grafana/dashboards
    depends_on:
      timescaledb:
        condition: service_healthy

volumes:
  tsdb_data:
  mlflow_artifacts:
  grafana_data:
'@

New-File 'local-mlops/.env.example' @'
# Copy to .env — never commit .env
TSDB_USER=rezon
TSDB_PASSWORD=change_me
GRAFANA_PASSWORD=change_me
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key
TIMESCALEDB_URL=postgresql://rezon:change_me@localhost:5433/rezon
MLFLOW_TRACKING_URI=http://localhost:5000
'@

New-File 'local-mlops/timescaledb/init/01_schema.sql' '-- TimescaleDB schema — implemented in Session 29'
New-File 'local-mlops/timescaledb/init/02_seed.sql' '-- Optional seed data'
New-File 'local-mlops/grafana/provisioning/datasources/timescaledb.yml' '# Datasource config — Session 32'
New-File 'local-mlops/grafana/provisioning/dashboards/rezon.yml' '# Dashboard loader config — Session 32'
New-File 'local-mlops/grafana/dashboards/rezon_overview.json' '{}'
New-File 'local-mlops/mlflow/.gitkeep' '# Docker volume — contents managed by MLflow'

New-File 'local-mlops/scripts/requirements.txt' @'
psycopg2-binary>=2.9
sqlalchemy>=2.0
pandas>=2.0
numpy>=1.24
evidently>=0.4
mlflow>=2.10
requests>=2.31
python-dotenv>=1.0
'@

New-File 'local-mlops/scripts/.env.example' @'
SUPABASE_URL=
SUPABASE_SERVICE_KEY=
TIMESCALEDB_URL=postgresql://rezon:change_me@localhost:5433/rezon
MLFLOW_TRACKING_URI=http://localhost:5000
'@

New-File 'local-mlops/scripts/scheduled_run.py' '# REZON scheduled maintenance script — Session 31'
New-File 'local-mlops/scripts/data_operations.py' '# REZON data operations (DEC-069) — Session 31'

# ── Training ───────────────────────────────────────────────────────────────
New-Dir 'training/data/raw'
New-Dir 'training/data/processed'
New-Dir 'training/data/held_out'
New-Dir 'training/models/float32'
New-Dir 'training/models/int8'
New-Dir 'training/src'
New-Dir 'training/tests'

New-File 'training/src/__init__.py' ''
New-File 'training/tests/__init__.py' ''

New-File 'training/requirements.txt' @'
tensorflow>=2.14
tensorflow-model-optimization>=0.7
numpy>=1.24
librosa>=0.10
soundfile>=0.12
scikit-learn>=1.3
matplotlib>=3.7
mlflow>=2.10
pytest>=7.4
python-dotenv>=1.0
'@

New-File 'training/README.md' @'
# REZON Training Pipeline

## CRITICAL WARNING: features.py must match firmware C bit-for-bit
src/features.py log-mel extraction MUST use identical parameters to
firmware/main/sensors/inmp441.c. Any mismatch = model trained on
different features than it runs on (silent, catastrophic failure).

Parameters (config.h / AI/ML Spec §1):
  Sample rate:  16000 Hz
  FFT window:   1024
  Hop size:     512
  Mel bins:     40 (0-8000 Hz range)
  Context:      +/-3 frames = 240-dim IDNN input

## AUC gate
Held-out AUC >= 0.85 is a hard requirement (MLPerf Tiny).
Failed model -> Blocker Report. Never silently deployed.

## Sessions
  Session 5:  Stage 1+2 training (model.py, train.py, augment.py, features.py)
  Session 6:  QAT + eval + TFLite export (qat.py, evaluate.py, export.py)
  Session 34: Post-burn-in calibration fine-tune
'@

# ── Root files ─────────────────────────────────────────────────────────────
New-File '.gitattributes' @'
*.c   text eol=lf
*.h   text eol=lf
*.cc  text eol=lf
*.cpp text eol=lf
*.md  text eol=lf
*.py  text eol=lf
*.sql text eol=lf
*.ts  text eol=lf
*.tsx text eol=lf
*.yml text eol=lf
*.json text eol=lf
'@

New-File '.gitignore' @'
# Secrets
.env
*.key
*.pem

# Firmware build
firmware/build/
firmware/managed_components/
firmware/.cache/
firmware/sdkconfig
firmware/sdkconfig.old

# Frontend
frontend/node_modules/
frontend/.next/
frontend/.env.local
frontend/.env.production

# Training data and model artifacts (large files)
training/data/raw/
training/data/processed/
training/data/held_out/
training/models/
*.tflite
*.h5
*.pb

# Local MLOps volumes
local-mlops/mlflow/
local-mlops/.env
local-mlops/scripts/.env

# Python
__pycache__/
*.pyc
*.pyo
.pytest_cache/
*.egg-info/
.venv/
venv/

# OS
.DS_Store
Thumbs.db
*.swp
'@

Write-Host ""
Write-Host "REZON scaffold complete." -ForegroundColor Green
Write-Host ""
Write-Host "Created:" -ForegroundColor Cyan
Write-Host "  firmware/              config.h, types.h, CMakeLists.txt, partitions.csv, sdkconfig.defaults"
Write-Host "  supabase/              config.toml + full initial schema migration"
Write-Host "  frontend/              placeholder only (create-next-app in Session 10)"
Write-Host "  local-mlops/           docker-compose.yml, .env.example, requirements.txt"
Write-Host "  training/              requirements.txt, README.md, __init__.py files"
Write-Host "  .gitignore             covers all layers"
Write-Host "  .gitattributes         LF line endings for C files on Windows"
Write-Host ""
Write-Host "Next step: git init, then Session 1." -ForegroundColor Yellow
