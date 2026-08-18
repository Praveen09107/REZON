-- REZON initial schema â€” specs/technical/03_BACKEND_CLOUD_TECHNICAL_SPEC.md Â§1
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
