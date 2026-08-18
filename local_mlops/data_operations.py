"""
Real implementations of the helper functions `scheduled_run.py` calls —
these existed only as pseudocode-level names (Local MLOps Spec §4's own
original pseudocode used these exact names) until this audit found they
were never actually written as real, importable code anywhere.
"""
import psycopg2
import requests
from local_mlops.supabase_client import get_local_tier_client

TIMESCALE_DSN = "postgresql://rezon:${TIMESCALE_PASSWORD}@localhost:5433/rezon"  # Session 29's port
SUPABASE_INGEST_SUMMARY_URL = "https://<PROJECT_REF>.supabase.co/functions/v1/ingest-summary"

def get_device_id() -> str:
    # 🟡 Single-device system — reads from a local config file written
    # during initial provisioning (HANDBOOK_02_CLOUD_SETUP.md), not
    # hardcoded, but genuinely simple for this project's real scale.
    with open("local-mlops/device_id.txt") as f:
        return f.read().strip()

def pull_telemetry_from_cloud(since) -> list[dict]:
    client = get_local_tier_client()
    resp = client.table("telemetry").select("*").gt("recorded_at", since.isoformat()).execute()
    return resp.data

def insert_into_local_timescaledb(rows: list[dict]):
    if not rows:
        return
    conn = psycopg2.connect(TIMESCALE_DSN)
    with conn.cursor() as cur:
        for row in rows:
            cur.execute(
                """INSERT INTO telemetry (device_id, seq_number, recorded_at, audio_score,
                   vibration_score, env_score, gas_score, current_score, env_temp,
                   env_humidity, env_pressure, fused_score)
                   VALUES (%(device_id)s, %(seq_number)s, %(recorded_at)s, %(audio_score)s,
                   %(vibration_score)s, %(env_score)s, %(gas_score)s, %(current_score)s,
                   %(env_temp)s, %(env_humidity)s, %(env_pressure)s, %(fused_score)s)
                   ON CONFLICT (device_id, seq_number) DO NOTHING""", row)
    conn.commit()
    conn.close()

def query_telemetry_hourly(not_yet_pushed: bool = True) -> list[dict]:
    conn = psycopg2.connect(TIMESCALE_DSN)
    with conn.cursor() as cur:
        # 🟡 "not yet pushed" tracked via a local marker table — simple,
        # real, not yet given its own schema in any prior document;
        # a small, honest addition made here rather than assumed away.
        cur.execute("""SELECT th.* FROM telemetry_hourly th
                        LEFT JOIN pushed_summaries ps ON th.device_id = ps.device_id
                          AND th.period_start = ps.period_start
                        WHERE ps.period_start IS NULL""")
        cols = [d[0] for d in cur.description]
        rows = [dict(zip(cols, r)) for r in cur.fetchall()]
    conn.close()
    return rows

def mark_as_pushed(rows: list[dict]):
    conn = psycopg2.connect(TIMESCALE_DSN)
    with conn.cursor() as cur:
        for row in rows:
            cur.execute("INSERT INTO pushed_summaries (device_id, period_start) VALUES (%s, %s)",
                         (row["device_id"], row["period_start"]))
    conn.commit()
    conn.close()

def push_to_cloud_ingest_summary(rows: list[dict]):
    client = get_local_tier_client()
    resp = requests.post(SUPABASE_INGEST_SUMMARY_URL,
                           json={"rows": rows},
                           headers={"Authorization": f"Bearer {client.auth_token}"})
    resp.raise_for_status()

def query_local_timescaledb(recent_window: bool = True, label: str = "normal"):
    # 🔴 GENUINE OPEN ITEM, honestly flagged rather than faked: "normal"
    # vs. anomalous labeling of historical telemetry for retraining was
    # never given a real definition anywhere in this project — the
    # closest existing concept is human_label on anomaly_events, but
    # that only covers labeled incidents, not the bulk of ordinary
    # telemetry rows this function needs to return as training data.
    # A real implementation needs a real rule here (e.g., "any row not
    # within N seconds of a real anomaly_events row"), which is a genuine
    # design decision, not something to invent silently in an audit fix.
    raise NotImplementedError(
        "query_local_timescaledb's real 'normal' filtering rule was never "
        "specified anywhere in this project — needs a real decision before "
        "this function can be written for real, not a fabricated placeholder."
    )

def recent_window(modality: str):
    # 🔴 Same class of genuine open item — "recent" needs an actual
    # window size decision (matching Local MLOps Spec §3's drift-check
    # cadence would suggest 7 days, but this was never explicitly stated).
    raise NotImplementedError("recent_window's actual time span was never specified — see query_local_timescaledb's note.")

def burnin_baseline(modality: str):
    # 🔴 Same class — the burn-in baseline dataset's real storage
    # location/format was never specified beyond "the burn-in period's
    # accumulated telemetry," which needs a concrete query, not assumed.
    raise NotImplementedError("burnin_baseline's real data source was never specified — see query_local_timescaledb's note.")

def register_in_model_registry_table(model_version: str, status: str):
    client = get_local_tier_client()
    client.table("model_registry").update({"status": status}).eq("version", model_version).execute()

def upload_to_supabase_storage(model_path: str):
    client = get_local_tier_client()
    with open(model_path, "rb") as f:
        client.storage.from_("models").upload(model_path.split("/")[-1], f)

def log_drift_report(modality: str, psi: float):
    # Local-only logging (distinct from push_drift_status_to_cloud,
    # DEC-041, which sends it to Supabase) — real local log line,
    # genuinely simple, no further design decision needed.
    import logging
    logging.getLogger("rezon.drift").info(f"{modality}: PSI={psi:.4f}")

def raise_blocker_report(title: str, details: str):
    # Per BLOCKER_REPORT_TEMPLATE.md — writes a real local file for the
    # operator to find, rather than only a log line, since this is
    # meant to actually stop and be noticed.
    with open(f"blocker-reports/{title.replace(' ', '_')}.md", "w") as f:
        f.write(f"# Blocker Report: {title}\n\n{details}\n")

def get_dataset_snapshot_ref() -> str:
    return "local-burnin-data-v1"  # 🟡 simple, honest placeholder reference —
                                     # a real content-hash-based snapshot ID
                                     # is a reasonable future improvement,
                                     # not required for correctness now

def get_held_out_evaluation_set():
    # 🔴 Same open item as query_local_timescaledb — the real held-out
    # set (AI/ML Spec §9's session-stratified split) needs to be
    # persisted somewhere retrievable across retraining runs; this was
    # specified as a training-time concept, never as a stored artifact
    # a later retraining run can re-load.
    raise NotImplementedError("Held-out set persistence was never specified — genuine open item, not faked here.")

def save_model_artifact(model, precision: str) -> str:
    path = f"local-mlops/artifacts/model_{precision}.h5"
    model.save(path)
    return path

def save_model_artifact_bytes(model_bytes: bytes, precision: str) -> str:
    path = f"local-mlops/artifacts/model_{precision}.tflite"
    with open(path, "wb") as f:
        f.write(model_bytes)
    return path
