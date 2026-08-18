from unittest.mock import patch, MagicMock
from local_mlops.scheduled_run import scheduled_maintenance_run
import datetime

def test_drift_check_only_runs_on_cadence():
    """The single most important test in this session: confirm the
    drift check genuinely does NOT run every single invocation, only
    every 7+ days — a bug here would mean either wasted compute
    (checking too often) or missed drift (never checking), and it's
    exactly the kind of off-by-logic error that's easy to introduce
    silently."""
    state = {
        "last_pull_checkpoint": datetime.datetime.now(),
        "last_drift_check": datetime.datetime.now(),  # just checked
    }
    with patch("local_mlops.scheduled_run.pull_telemetry_from_cloud", return_value=[]), \
         patch("local_mlops.scheduled_run.query_telemetry_hourly", return_value=[]), \
         patch("local_mlops.scheduled_run.check_all_modalities") as mock_drift:
        scheduled_maintenance_run(state)
        mock_drift.assert_not_called()  # 0 days since last check — should NOT run

def test_drift_check_runs_after_interval():
    state = {
        "last_pull_checkpoint": datetime.datetime.now(),
        "last_drift_check": datetime.datetime.now() - datetime.timedelta(days=8),
    }
    with patch("local_mlops.scheduled_run.pull_telemetry_from_cloud", return_value=[]), \
         patch("local_mlops.scheduled_run.query_telemetry_hourly", return_value=[]), \
         patch("local_mlops.scheduled_run.check_all_modalities", return_value={}) as mock_drift, \
         patch("local_mlops.scheduled_run.burnin_baseline", return_value=[]), \
         patch("local_mlops.scheduled_run.recent_window", return_value=[]), \
         patch("local_mlops.scheduled_run.get_local_tier_client"):
        scheduled_maintenance_run(state)
        mock_drift.assert_called_once()  # 8 days since — SHOULD run

def test_only_audio_drift_triggers_retrain():
    state = {"last_pull_checkpoint": datetime.datetime.now(),
              "last_drift_check": datetime.datetime.now() - datetime.timedelta(days=8)}
    drift_results = {"audio": {"psi": 0.05, "status": "stable"},
                       "vibration": {"psi": 0.35, "status": "significant"}}  # HIGH drift, but not audio
    with patch("local_mlops.scheduled_run.pull_telemetry_from_cloud", return_value=[]), \
         patch("local_mlops.scheduled_run.query_telemetry_hourly", return_value=[]), \
         patch("local_mlops.scheduled_run.check_all_modalities", return_value=drift_results), \
         patch("local_mlops.scheduled_run.burnin_baseline", return_value=[]), \
         patch("local_mlops.scheduled_run.recent_window", return_value=[]), \
         patch("local_mlops.scheduled_run.get_local_tier_client"), \
         patch("local_mlops.scheduled_run.trigger_retrain") as mock_retrain:
        scheduled_maintenance_run(state)
        mock_retrain.assert_not_called()  # vibration drifted, not audio — should NOT retrain
