# SESSION 32 — Grafana Dashboards
**Risk tier: ROUTINE.**
**Branch: `session/build-32-grafana`**
**Attach: `04_LOCAL_MLOPS_TECHNICAL_SPEC.md` §1 (as corrected, `DEC-055`), Sessions 29-31 (as actually built)**

---

## Agent Instructions

Provision Grafana as code — real datasource config + real dashboard JSON, not manually clicked together (which wouldn't survive a container rebuild). This is the deep operational view distinct from the public-facing frontend (Frontend Spec §6's Analytics page) — Grafana is for you, running against the full local TimescaleDB history, not the cloud's 30-day-retained thin copy.

**What this session creates:**
- `local-stack/grafana/provisioning/datasources/timescaledb.yml`
- `local-stack/grafana/provisioning/dashboards/dashboard-provider.yml`
- `local-stack/grafana/dashboards/rezon-operational.json`

---

## FILE 1: `local-stack/grafana/provisioning/datasources/timescaledb.yml`

```yaml
apiVersion: 1
datasources:
  - name: RezonTimescaleDB
    type: postgres
    access: proxy
    url: timescaledb:5432   # internal Docker network name, per
                              # Session 29's compose service name —
                              # not localhost, since Grafana reaches
                              # it via the shared rezon-internal network
    database: rezon
    user: rezon
    secureJsonData:
      password: ${TIMESCALE_PASSWORD}
    jsonData:
      sslmode: disable   # internal Docker network only, per ADD §16 —
                           # not exposed beyond it, so this is an
                           # accepted, deliberate simplification, not
                           # an oversight
      postgresVersion: 1600
      timescaledb: true
```

## FILE 2: `local-stack/grafana/provisioning/dashboards/dashboard-provider.yml`

```yaml
apiVersion: 1
providers:
  - name: rezon
    folder: REZON
    type: file
    options:
      path: /etc/grafana/dashboards
```

## FILE 3: `local-stack/grafana/dashboards/rezon-operational.json`

```json
{
  "title": "REZON Operational",
  "panels": [
    {
      "title": "Fused score — 7 days",
      "type": "timeseries",
      "gridPos": {"x": 0, "y": 0, "w": 12, "h": 8},
      "targets": [{
        "rawSql": "SELECT period_start AS time, avg_fused_score FROM telemetry_hourly WHERE $__timeFilter(period_start) ORDER BY period_start",
        "format": "time_series"
      }]
    },
    {
      "title": "Per-modality average — 7 days",
      "type": "timeseries",
      "gridPos": {"x": 12, "y": 0, "w": 12, "h": 8},
      "targets": [{
        "rawSql": "SELECT period_start AS time, avg_audio_score, avg_vibration_score, avg_env_score, avg_gas_score, avg_current_score FROM telemetry_hourly WHERE $__timeFilter(period_start) ORDER BY period_start",
        "format": "time_series"
      }]
    },
    {
      "title": "Drift status — current",
      "type": "table",
      "gridPos": {"x": 0, "y": 8, "w": 8, "h": 6},
      "targets": [{
        "rawSql": "SELECT modality, psi_value, status, checked_at FROM drift_status ORDER BY modality",
        "format": "table"
      }]
    },
    {
      "title": "Model registry history",
      "type": "table",
      "gridPos": {"x": 8, "y": 8, "w": 8, "h": 6},
      "targets": [{
        "rawSql": "SELECT version, held_out_auc, status, created_at FROM model_registry ORDER BY created_at DESC",
        "format": "table"
      }]
    },
    {
      "title": "Event count per day",
      "type": "barchart",
      "gridPos": {"x": 16, "y": 8, "w": 8, "h": 6},
      "targets": [{
        "rawSql": "SELECT period_start AS time, sample_count FROM telemetry_hourly WHERE $__timeFilter(period_start) ORDER BY period_start",
        "format": "time_series"
      }]
    }
  ],
  "time": {"from": "now-7d", "to": "now"},
  "refresh": "1m"
}
```

---

## Verification Steps

**Step 1:** `docker compose restart grafana`, log into the Grafana UI (`127.0.0.1:3001`, per Session 29's binding), confirm the `RezonTimescaleDB` datasource shows green/connected without manual configuration — the whole point of provisioning-as-code is zero manual clicking after a fresh container start.

**Step 2:** Confirm the "REZON Operational" dashboard appears automatically in the REZON folder, not requiring manual import.

**Step 3 (real data, not an empty dashboard):** with real data flowing through Sessions 29-31's pipeline, confirm each panel shows real values — specifically confirm the per-modality panel shows all 5 lines including `avg_env_score`, the direct visual proof `DEC-055`'s fix is reflected here too, not just in the raw table.

**Step 4:** Change the time range to "last 30 days" — confirm panels genuinely query a wider window (real proof this isn't hardcoded to `now-7d` despite the dashboard's default), since local TimescaleDB's 90-day retention (Session 29) should support this, unlike the cloud's 30-day-limited view.

## Known open items
None.
