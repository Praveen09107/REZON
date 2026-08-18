# Handbook 03 — Local Stack Setup
**Standing up the local MLOps tier per `04_LOCAL_MLOPS_TECHNICAL_SPEC.md`, and Tailscale for private access.**

## 1. Docker Compose stack
Build the `docker-compose.yml` covering: TimescaleDB, MLflow, Grafana, and the environment for the scheduled script (Evidently as a library dependency inside that script's own container/environment, not a separate service — per Local MLOps Spec §3's explicit design).

## 2. TimescaleDB setup
1. `docker compose up -d timescaledb`
2. Run the hypertable + retention + continuous-aggregate SQL from Local MLOps Spec §1.
3. Confirm with `\dx` in `psql` that the `timescaledb` extension is genuinely active (unlike the cloud tier, which deliberately doesn't have this).

## 3. MLflow
Standard self-hosted MLflow tracking server, backed by a Postgres database (can be the same TimescaleDB instance, a separate schema) — Local MLOps Spec §2's stage-transition logic is application-level, on top of MLflow's native registry.

## 4. Grafana
Point it at the local TimescaleDB instance for the deep operational dashboards (distinct from the public frontend).

## 5. The scheduled script
Set up as a cron job or a simple `while true: sleep(interval)` loop — Local MLOps Spec §4's pseudocode is the source of truth for what it actually does each run.

## 6. Tailscale
1. Install Tailscale on this machine.
2. Confirm it joins your private tailnet.
3. Configure Grafana/MLflow to bind only to the Tailscale interface, not `0.0.0.0` — this is the actual security boundary (ADD §16), not a suggestion.

## 7. Confirm before moving on
From a different device on your Tailscale network (e.g., your phone with the Tailscale app), confirm you can reach Grafana — and confirm you canNOT reach it from a device outside your tailnet.
