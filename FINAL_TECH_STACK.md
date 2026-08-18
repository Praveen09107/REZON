# REZON — Final Technology Stack (Consolidated Reference)

## Hardware
- MCU: ESP32-S3-WROOM-1 N16R8 (16MB Flash + 8MB PSRAM, dual-core Xtensa LX7 @240MHz), EdgeHax board
- Audio: INMP441 (I2S digital MEMS microphone)
- Vibration: MPU-6050 (6-axis IMU) + SW-420 (active hardware-corroboration diagnostic, not just backup)
- Environment: DHT22 (temp/humidity) + BMP280 (pressure)
- Gas: MQ135 (via voltage divider)
- Current: ACS712, 5A range
- Actuation: 5V single-channel relay, Songle optocoupler
- Safety: physical manual override switch, firmware-independent
- Output: RGB LED, active buzzer
- Storage: MicroSD
- Power: AMS1117 3.3V regulator

## Firmware
- RTOS: FreeRTOS via ESP-IDF
- Audio: I2S DMA + ESP-DSP (FFT)
- ML inference: TensorFlow Lite Micro + ESP-NN
- Persistent state: NVS

## AI / ML
- Audio: IDNN (custom FC, ~55K params), plain-AE A/B baseline
- Vibration/gas/current: self-calibrating statistical monitors (no trained model)
- Quantization: QAT, INT8
- Training: TensorFlow/Keras -> TFLite, on local GPU (RTX 3050, 4GB) primary, Colab fallback
- Augmentation: SpecAugment + mixup + RIR convolution (normal class, real-data-only); pretrained generative synthesis from real seeds (anomaly class only)
- Datasets: ESC-50 + UrbanSound8K (primary) / DCASE + MIMII + ToyADMOS2 (secondary/methodology)
- Drift: Evidently (library, PSI, 0.2 threshold)
- Registry: MLflow

## Communication
- Transport: direct HTTPS (not MQTT)
- Security: TLS + per-device secret
- Reliability: NVS-persisted sequence number + server UNIQUE constraint (idempotency)

## Cloud Backend
- Platform: Supabase (DB + Auth + Storage + Edge Functions, single vendor)
- Edge Functions: Deno runtime
- Database: plain Postgres (no Timescale extension in cloud)
- Auth: Supabase Auth, operator/viewer roles via RLS

## Frontend
- Framework: Next.js
- UI: shadcn/ui + Tailwind CSS
- Hosting: Vercel

## Local / Self-Hosted MLOps Tier
- Containerization: Docker Compose
- Time-series DB: TimescaleDB (full-featured, self-hosted)
- Registry: MLflow
- Drift: Evidently (library)
- Dashboards: Grafana
- Orchestration: one scheduled Python script (not Airflow/Prefect)
- Remote access: Tailscale (private, never public)

## Implementation Tooling
- Agent: Claude Code
- VCS: Git + GitHub
- Methodology: AEGIS-derived, adapted (safety carve-out, HW verification, timeline phasing)

## Explicitly rejected (reasoning in DECISIONS_LOG.md and ADD Decision Log §23)
MQTT/broker, Oracle Cloud, Firebase/Appwrite, Airflow/Prefect, Redis/task queues, public admin exposure.
