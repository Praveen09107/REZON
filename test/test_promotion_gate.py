from local_mlops.mlflow_tracking import evaluate_promotion
from unittest.mock import patch, MagicMock

def test_promotion_fails_below_hard_bar():
    with patch("local_mlops.mlflow_tracking.MlflowClient") as MockClient:
        MockClient.return_value.get_latest_versions.return_value = []
        result = evaluate_promotion("1", held_out_auc=0.80)  # below 0.85
        assert result["promoted"] is False
        assert result["blocker_report_required"] is True

def test_promotion_fails_if_worse_than_incumbent():
    with patch("local_mlops.mlflow_tracking.MlflowClient") as MockClient:
        mock_prod = MagicMock(run_id="r1", version="1")
        MockClient.return_value.get_latest_versions.return_value = [mock_prod]
        MockClient.return_value.get_run.return_value.data.metrics = {"held_out_auc": 0.92}
        result = evaluate_promotion("2", held_out_auc=0.87)  # passes hard bar, worse than 0.92
        assert result["promoted"] is False

def test_promotion_succeeds_when_both_gates_pass():
    with patch("local_mlops.mlflow_tracking.MlflowClient") as MockClient:
        MockClient.return_value.get_latest_versions.return_value = []  # no incumbent
        result = evaluate_promotion("1", held_out_auc=0.90)
        assert result["promoted"] is True
