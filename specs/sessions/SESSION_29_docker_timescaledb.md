# SESSION 29 — Docker Compose + TimescaleDB
**Risk tier: HIGH-RISK (infrastructure — a wrong retention policy or a misconfigured aggregate is expensive to notice late).**
**Branch: `session/build-29-docker-timescaledb`**
**Attach: `04_LOCAL_MLOPS_TECHNICAL_SPEC.md` §1 (as corrected, `DEC-055`), `HANDBOOK_03_LOCAL_STACK_SETUP.md`**

---

## Agent Instructions

Stand up the real Docker Compose stack and the corrected TimescaleDB schema. This is genuinely infrastructure work — closer in nature to Phase 1's firmware sessions than the frontend pages, so expect real config depth, not a thin wrapper.

**What this session creates:**
- `local-stack/docker-compose.yml`
- `local-stack/timescaledb/init.sql` — the real, corrected schema from `DEC-055`
- `local-stack/.env.example`

---

## FILE 1: `local-stack/docker-compose.yml`

```yaml
version: "3.9"

services:
  timescaledb:
    image: timescale/timescaledb:latest-pg16
    container_name: rezon-timescaledb
    restart: unless-stopped
    environment:
      POSTGRES_DB: rezon
      POSTGRES_USER: rezon
      POSTGRES_PASSWORD: ${TIMESCALE_PASSWORD}
    ports:
      - "5433:5432"   # non-default host port — avoids colliding with
                        # any other local Postgres instance
    volumes:
      - timescale_data:/var/lib/postgresql/data
      - ./timescaledb/init.sql:/docker-entrypoint-initdb.d/init.sql:ro
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U rezon"]
      interval: 10s
      timeout: 5s
      retries: 5
    networks:
      - rezon-internal   # NOT exposed beyond localhost/Tailscale — per
                           # ADD §16's security design, re-verified here

  mlflow:
    image: ghcr.io/mlflow/mlflow:latest
    container_name: rezon-mlflow
    restart: unless-stopped
    depends_on:
      timescaledb:
        condition: service_healthy
    environment:
      - BACKEND_STORE_URI=postgresql://rezon:${TIMESCALE_PASSWORD}@timescaledb:5432/rezon
    command: mlflow server --host 0.0.0.0 --port 5000 --backend-store-uri ${BACKEND_STORE_URI}
    ports:
      - "127.0.0.1:5000:5000"   # bound to localhost only — Tailscale
                                  # access happens via the host's own
                                  # Tailscale interface, not a Docker
                                  # port publish to 0.0.0.0
    networks:
      - rezon-internal

  grafana:
    image: grafana/grafana:latest
    container_name: rezon-grafana
    restart: unless-stopped
    depends_on:
      timescaledb:
        condition: service_healthy
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=${GRAFANA_ADMIN_PASSWORD}
    ports:
      - "127.0.0.1:3001:3000"   # same localhost-only binding —
                                  # Session 33 (cloud hardening) revisits
                                  # this explicitly as part of its scope
    volumes:
      - grafana_data:/var/lib/grafana
    networks:
      - rezon-internal

volumes:
  timescale_data:
  grafana_data:

networks:
  rezon-internal:
    driver: bridge
```

## FILE 2: `local-stack/timescaledb/init.sql`

```sql
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
```

## FILE 3: `local-stack/.env.example`

```
TIMESCALE_PASSWORD=changeme_real_password_here
GRAFANA_ADMIN_PASSWORD=changeme_real_password_here
```

---

## Verification Steps

**Step 1:** `docker compose up -d`, then `docker compose ps` — confirm all 3 services show `healthy`, not just `running` (per `VERIFY_04`'s "healthy, not just running" distinction).

**Step 2 (real, not assumed):** `docker exec -it rezon-timescaledb psql -U rezon -d rezon -c "\dx"` — confirm `timescaledb` extension is genuinely listed as active, not just that the container started without error.

**Step 3:** Insert a real test row into `telemetry` directly via `psql`, wait past the hourly refresh window (or manually trigger a refresh for testing), confirm `telemetry_hourly` reflects it — including confirming `avg_env_score` specifically is populated, not null, the literal proof `DEC-055`'s fix actually works end to end.

**Step 4 — the security check, not just a functional one:** from a machine OUTSIDE your Tailscale network, attempt to reach `<host-ip>:5000` and `<host-ip>:3001` — confirm both genuinely fail to connect (the `127.0.0.1`-only binding holding), not just that you didn't try from inside.

## Known open items
None.
