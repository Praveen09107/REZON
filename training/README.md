# REZON Training Pipeline

## CRITICAL WARNING: features.py must match firmware C bit-for-bit
src/features.py log-mel extraction MUST use identical parameters to
firmware/main/sensors/inmp441.c. Any mismatch = model trained on
different features than it runs on (silent, catastrophic failure).

Parameters (config.h / AI/ML Spec Â§1):
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
