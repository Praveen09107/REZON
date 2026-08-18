CREATE EXTENSION IF NOT EXISTS timescaledb;

-- Full local telemetry table — mirrors the cloud schema's columns
-- exactly (Backend Spec §1, including env_score per DEC-017), as a
-- genuine hypertable rather than a plain table.
CREATE TABLE telemetry (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id         uuid NOT NULL,
  seq_number        bigint NOT NULL,
  recorded_at       timestamptz NOT NULL,
  received_at       timestamptz NOT NULL DEFAULT now(),
  audio_score       real, vibration_score real, env_score real, gas_score real, current_score real,
  env_temp real, env_humidity real, env_pressure real,
  fused_score       real NOT NULL,
  UNIQUE (device_id, seq_number)
);

SELECT create_hypertable('telemetry', 'recorded_at');

SELECT add_retention_policy('telemetry', INTERVAL '90 days');

-- Continuous aggregates — the exact, now-corrected definition from
-- Local MLOps Spec §1 (DEC-055): includes avg_env_score.
CREATE MATERIALIZED VIEW telemetry_hourly
WITH (timescaledb.continuous) AS
SELECT
  device_id,
  time_bucket('1 hour', recorded_at) AS period_start,
  avg(fused_score) AS avg_fused_score,
  max(fused_score) AS max_fused_score,
  avg(audio_score) AS avg_audio_score,
  avg(vibration_score) AS avg_vibration_score,
  avg(env_score) AS avg_env_score,
  avg(gas_score) AS avg_gas_score,
  avg(current_score) AS avg_current_score,
  count(*) FILTER (WHERE fused_score > 0) AS sample_count
FROM telemetry
GROUP BY device_id, period_start;

CREATE MATERIALIZED VIEW telemetry_daily
WITH (timescaledb.continuous) AS
SELECT device_id, time_bucket('1 day', recorded_at) AS period_start,
       avg(fused_score) AS avg_fused_score, max(fused_score) AS max_fused_score
FROM telemetry GROUP BY device_id, period_start;

SELECT add_continuous_aggregate_policy('telemetry_hourly',
  start_offset => INTERVAL '3 hours', end_offset => INTERVAL '1 hour',
  schedule_interval => INTERVAL '1 hour');

SELECT add_continuous_aggregate_policy('telemetry_daily',
  start_offset => INTERVAL '2 days', end_offset => INTERVAL '1 hour',
  schedule_interval => INTERVAL '1 day');
