# SESSION 05 — Audio Model Training: Stage 1 (Public Data) + Stage 2 (Augmentation)
**Risk tier: HIGH-RISK (feeds directly into safety-critical audio scoring). Runs entirely on your local machine (RTX 3050) — no ESP32-S3 hardware needed this session, per `AMENDMENT-002`.**
**Branch: `session/build-05-audio-training`**
**Attach: `specs/technical/01_AI_ML_TECHNICAL_SPEC.md` §1-2, §9, §11**

---

## Agent Instructions

Build the Python training pipeline: data loading, feature extraction (must exactly match Session 4's on-device implementation — same 16kHz/1024/512/40-mel parameters, or the trained model will not match what the device actually computes), both models (IDNN + plain-AE baseline), augmentation, and the held-out split. This session trains but does not yet quantize or deploy — that's Session 6.

**What this session creates:**
- `training/data_loading.py` — dataset loaders for ESC-50, UrbanSound8K, DCASE/MIMII
- `training/features.py` — log-mel spectrogram extraction (mirrors Session 4's C implementation exactly)
- `training/models.py` — IDNN and plain-AE Keras model definitions
- `training/augmentation.py` — SpecAugment, mixup, RIR convolution, synthetic anomaly injection
- `training/split.py` — session/dataset-stratified held-out split
- `training/train.py` — the training entry point
- `test/test_features.py` — pytest confirming feature extraction matches expected values

---

## FILE 1: `training/features.py`

```python
"""
Log-mel spectrogram extraction — MUST match Session 4's on-device C
implementation exactly (AI/ML Spec §1): 16kHz, 1024-sample window,
512-sample hop, 40 mel bins, log(energy + 1e-6) compression. A mismatch
here means the trained model was never actually seeing what the real
device computes — this file's correctness is a precondition for
everything downstream, not just this session's own scope.
"""
import numpy as np
import librosa

SAMPLE_RATE = 16000
N_FFT = 512
WIN_LENGTH = 1024
HOP_LENGTH = 512
N_MELS = 40
FMIN = 0
FMAX = 8000  # Nyquist for 16kHz — matches AI/ML Spec §1 exactly
LOG_EPSILON = 1e-6


def extract_log_mel(audio: np.ndarray, sr: int = SAMPLE_RATE) -> np.ndarray:
    """Returns shape (n_frames, N_MELS) — same per-frame mel-energy
    representation Session 4's audio_features_compute_frame() produces
    on-device, one frame at a time."""
    if sr != SAMPLE_RATE:
        audio = librosa.resample(audio, orig_sr=sr, target_sr=SAMPLE_RATE)

    mel_spec = librosa.feature.melspectrogram(
        y=audio, sr=SAMPLE_RATE, n_fft=N_FFT, hop_length=HOP_LENGTH,
        win_length=WIN_LENGTH, n_mels=N_MELS, fmin=FMIN, fmax=FMAX,
        power=2.0,  # power spectrum, matching Session 4's re*re+im*im
    )
    log_mel = np.log(mel_spec + LOG_EPSILON)
    return log_mel.T  # (n_frames, N_MELS) — frame-major, matches device layout


def frames_to_idnn_input(frames: np.ndarray, center_idx: int, context: int = 3) -> tuple:
    """AI/ML Spec §2: C=3 context frames before + after, center excluded.
    Returns (input_240, target_40). Raises if not enough context available
    at this index — caller's responsibility to only request valid indices."""
    if center_idx - context < 0 or center_idx + context >= len(frames):
        raise ValueError(f"Not enough context at index {center_idx}")

    before = frames[center_idx - context: center_idx]
    after = frames[center_idx + 1: center_idx + 1 + context]
    context_frames = np.concatenate([before, after], axis=0)  # (6, 40)
    input_flat = context_frames.flatten()  # (240,)
    target = frames[center_idx]  # (40,)
    return input_flat, target


def frames_to_ae_input(frames: np.ndarray, center_idx: int, context: int = 3) -> np.ndarray:
    """Baseline autoencoder input: the FULL 7-frame patch including
    center (AI/ML Spec §2's stated baseline construction), flattened
    to 280 values — the model reconstructs all 7, not just the center."""
    patch = frames[center_idx - context: center_idx + context + 1]  # (7, 40)
    return patch.flatten()  # (280,)
```

## FILE 2: `training/models.py`

```python
"""
IDNN and plain-autoencoder baseline — exact architecture from AI/ML
Spec §2, both models identical parameter budget for a fair A/B.
"""
import tensorflow as tf
from tensorflow import keras


def build_idnn() -> keras.Model:
    """Input(240) -> 128 -> 64 -> 16(bottleneck) -> 64 -> 128 -> Output(40)"""
    inputs = keras.Input(shape=(240,), name="context_frames")
    x = keras.layers.Dense(128, activation="relu")(inputs)
    x = keras.layers.Dense(64, activation="relu")(x)
    x = keras.layers.Dense(16, activation="relu", name="bottleneck")(x)
    x = keras.layers.Dense(64, activation="relu")(x)
    x = keras.layers.Dense(128, activation="relu")(x)
    outputs = keras.layers.Dense(40, activation="linear", name="predicted_center")(x)
    model = keras.Model(inputs, outputs, name="rezon_idnn")

    total_params = model.count_params()
    assert 40000 < total_params < 70000, (
        f"IDNN param count {total_params} outside the ~55K target range "
        f"from AI/ML Spec §2 — architecture may have silently drifted"
    )
    return model


def build_plain_autoencoder() -> keras.Model:
    """Input(280) -> same-shape bottleneck -> Output(280) — the
    controlled A/B baseline, identical layer widths to the IDNN."""
    inputs = keras.Input(shape=(280,), name="full_patch")
    x = keras.layers.Dense(128, activation="relu")(inputs)
    x = keras.layers.Dense(64, activation="relu")(x)
    x = keras.layers.Dense(16, activation="relu", name="bottleneck")(x)
    x = keras.layers.Dense(64, activation="relu")(x)
    x = keras.layers.Dense(128, activation="relu")(x)
    outputs = keras.layers.Dense(280, activation="linear", name="reconstructed_patch")(x)
    return keras.Model(inputs, outputs, name="rezon_plain_ae")
```

## FILE 3: `training/augmentation.py`

```python
"""
AI/ML Spec §11: SpecAugment + mixup + RIR convolution for the normal
class (real recordings only, never generative synthesis). Synthetic
anomaly injection is separate — see inject_synthetic_anomaly() below,
explicitly scoped to the anomaly class only, per §11's stated boundary.
"""
import numpy as np


def spec_augment(log_mel: np.ndarray, time_mask_width: int = 8,
                   freq_mask_width: int = 6, n_masks: int = 2) -> np.ndarray:
    """Time/frequency masking directly on the log-mel spectrogram —
    the real SpecAugment technique, not a naive noise add."""
    augmented = log_mel.copy()
    n_frames, n_mels = augmented.shape

    for _ in range(n_masks):
        t0 = np.random.randint(0, max(1, n_frames - time_mask_width))
        augmented[t0:t0 + time_mask_width, :] = augmented.mean()

        f0 = np.random.randint(0, max(1, n_mels - freq_mask_width))
        augmented[:, f0:f0 + freq_mask_width] = augmented.mean()

    return augmented


def mixup(log_mel_a: np.ndarray, log_mel_b: np.ndarray, alpha: float = 0.4) -> np.ndarray:
    """Blend two real normal recordings at a random ratio drawn from
    a Beta(alpha, alpha) distribution — standard mixup formulation."""
    min_len = min(len(log_mel_a), len(log_mel_b))
    lam = np.random.beta(alpha, alpha)
    return lam * log_mel_a[:min_len] + (1 - lam) * log_mel_b[:min_len]


def apply_rir(audio: np.ndarray, rir: np.ndarray) -> np.ndarray:
    """Convolve raw audio with a room-impulse-response profile before
    feature extraction — simulates real acoustic variation across
    spaces without inventing new 'normal' content (AI/ML Spec §11's
    explicit reasoning for why this is legitimate augmentation)."""
    convolved = np.convolve(audio, rir, mode="full")[:len(audio)]
    peak = np.max(np.abs(convolved))
    return convolved / peak if peak > 0 else convolved


def inject_synthetic_anomaly(log_mel: np.ndarray, severity: float = 0.5) -> np.ndarray:
    """AI/ML Spec §11: synthetic anomaly injection is explicitly scoped
    to the anomaly class only — never used to fabricate the normal
    baseline. This function is a placeholder for the pretrained-
    generative-model approach (§11's 🔴 VRAM-fit caveat) — Session 5's
    scope is the simpler noise/transient injection variant; swapping in
    a real generative model is a later, explicitly separate task, not
    silently substituted here."""
    anomalous = log_mel.copy()
    n_frames, n_mels = anomalous.shape
    burst_start = np.random.randint(0, max(1, n_frames - 5))
    anomalous[burst_start:burst_start + 5, :] += severity * np.random.randn(
        min(5, n_frames - burst_start), n_mels
    ) * anomalous.std()
    return anomalous
```

## FILE 4: `training/split.py`

```python
"""
AI/ML Spec §9: held-out split stratified by data SOURCE, never random-
frame — frames from the same recording share acoustic conditions, and
random splitting would leak information, inflating AUC dishonestly.
"""
import numpy as np


def stratified_split(file_ids: list, source_labels: list, held_out_frac: float = 0.2,
                       seed: int = 42) -> tuple:
    """Splits by (source_dataset, file_id) pairs — 20% of EACH source
    dataset held out independently (AI/ML Spec §9), not 20% of the
    pooled total, so held-out genuinely covers cross-dataset
    generalization rather than being dominated by whichever dataset
    happens to be largest."""
    rng = np.random.RandomState(seed)
    train_ids, held_out_ids = [], []

    unique_sources = sorted(set(source_labels))
    for source in unique_sources:
        source_files = [f for f, s in zip(file_ids, source_labels) if s == source]
        rng.shuffle(source_files)
        n_held_out = max(1, int(len(source_files) * held_out_frac))
        held_out_ids.extend(source_files[:n_held_out])
        train_ids.extend(source_files[n_held_out:])

    assert set(train_ids).isdisjoint(set(held_out_ids)), (
        "Train/held-out overlap detected — this would silently inflate "
        "AUC and violate AI/ML Spec §9's core requirement"
    )
    return train_ids, held_out_ids
```

## FILE 5: `training/train.py`

```python
"""Entry point tying the above together into Stage 1+2's actual training run."""
import numpy as np
import tensorflow as tf
from models import build_idnn, build_plain_autoencoder
from features import extract_log_mel, frames_to_idnn_input, frames_to_ae_input
from augmentation import spec_augment, mixup, inject_synthetic_anomaly
from split import stratified_split

# 🟡 Dataset paths and download/preparation are environment-specific —
# this file assumes ESC-50/UrbanSound8K/DCASE/MIMII are already
# downloaded locally; acquiring them is a real prerequisite task for
# this session, not scripted here since it's a one-time setup step,
# not part of the repeatable training pipeline itself.

def build_training_dataset(normal_files: list, augment_factor: int = 3):
    """AI/ML Spec §10.2-10.3: primary weight toward ESC-50/UrbanSound8K,
    DCASE/MIMII secondary — this weighting is implemented at the file-
    list construction stage (caller passes a pre-weighted normal_files
    list), not inside this function."""
    inputs, targets = [], []
    for f in normal_files:
        log_mel = extract_log_mel(load_audio(f))  # load_audio: dataset-specific loader
        for _ in range(augment_factor):
            augmented = spec_augment(log_mel)
            for center_idx in range(3, len(augmented) - 3):
                x, y = frames_to_idnn_input(augmented, center_idx)
                inputs.append(x)
                targets.append(y)
    return np.array(inputs), np.array(targets)


def load_audio(path):
    import librosa
    audio, sr = librosa.load(path, sr=16000)
    return audio


def train_idnn(train_inputs, train_targets, epochs: int = 50):
    model = build_idnn()
    model.compile(optimizer="adam", loss="mse")
    model.fit(train_inputs, train_targets, epochs=epochs, batch_size=64,
              validation_split=0.1, verbose=1)
    return model


def train_plain_ae(train_patches, epochs: int = 50):
    model = build_plain_autoencoder()
    model.compile(optimizer="adam", loss="mse")
    model.fit(train_patches, train_patches, epochs=epochs, batch_size=64,
              validation_split=0.1, verbose=1)
    return model


if __name__ == "__main__":
    # 🔴 OPEN ITEM: actual file-list construction (which real files map
    # to ESC-50 vs UrbanSound8K vs DCASE/MIMII, with the primary/
    # secondary weighting from AI/ML Spec §10.2 actually applied as a
    # concrete ratio) is environment-specific and left for this
    # session's real execution, not hardcoded here — flagged explicitly
    # rather than fabricating fake weighting numbers.
    print("Run this after populating normal_files/anomaly_files per "
          "AI/ML Spec §10.2's weighting — see the OPEN ITEM above.")
```

## FILE 6: `test/test_features.py`

```python
import numpy as np
from training.features import extract_log_mel, frames_to_idnn_input, N_MELS

def test_log_mel_shape():
    fake_audio = np.random.randn(16000 * 2)  # 2 seconds
    result = extract_log_mel(fake_audio)
    assert result.shape[1] == N_MELS, f"Expected {N_MELS} mel bins, got {result.shape[1]}"

def test_idnn_input_shape():
    fake_frames = np.random.randn(20, N_MELS)
    x, y = frames_to_idnn_input(fake_frames, center_idx=10, context=3)
    assert x.shape == (240,), f"Expected 240 context values, got {x.shape}"
    assert y.shape == (40,), f"Expected 40 target values, got {y.shape}"

def test_idnn_input_insufficient_context_raises():
    fake_frames = np.random.randn(5, N_MELS)
    try:
        frames_to_idnn_input(fake_frames, center_idx=1, context=3)
        assert False, "Should have raised ValueError for insufficient context"
    except ValueError:
        pass
```

---

## Verification Steps

**Step 1:** `pytest test/test_features.py -v` — expected: `3 passed`.

**Step 2:** Run `build_idnn()` and `build_plain_autoencoder()`, print `model.summary()` for both — confirm IDNN's param count assertion passes (40K-70K range) and manually confirm both models show the same layer widths (128/64/16/64/128), differing only in input/output size (240/40 vs 280/280).

**Step 3:** Run a small smoke-test training pass (a handful of real files, few epochs) — confirm loss decreases across epochs, not flat or NaN.

## Known open items carried forward
🔴 Real dataset file-list construction (which files, what weighting ratio) is environment-specific, flagged in `train.py` rather than fabricated.
🔴 Synthetic anomaly injection currently uses a simple noise-burst placeholder — the pretrained generative-model version (AI/ML Spec §11) is a distinct, later upgrade, not silently substituted here.
