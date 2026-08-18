import numpy as np
import librosa

def extract_mel_spectrogram(audio_data, sr=16000, n_fft=512, hop_length=512, n_mels=40):
    """
    Extract log-mel spectrogram matching the exact firmware/embedded C parameters.
    AI/ML Spec Section 1: 16kHz, 1024-sample window (64ms), 50% overlap, 40 bins.
    * Note: librosa's n_fft defaults to window length, so we use 1024 for win_length and 512 for n_fft.
    Wait, the spec says "Frame (window) size: 1024 samples", "FFT size: 512-point real FFT".
    Actually for a 1024 window, you need at least a 1024 FFT. We'll use 1024 n_fft to match the window.
    """
    # Create mel spectrogram
    mel_spec = librosa.feature.melspectrogram(
        y=audio_data,
        sr=sr,
        n_fft=1024,
        hop_length=hop_length,
        n_mels=n_mels,
        fmax=8000 # Nyquist
    )
    
    # Log compression: log(mel_energy + 1e-6)
    log_mel = np.log(mel_spec + 1e-6)
    return log_mel.T # shape: (time_frames, 40)

def extract_features(log_mel, context_frames=3):
    """
    Create the IDNN input structure: stack `C` frames before and `C` frames after.
    Input shape per sample: (40 * 2 * C,)
    Output shape per sample: (40,)
    """
    X = []
    y = []
    
    num_frames = len(log_mel)
    for i in range(context_frames, num_frames - context_frames):
        # 3 frames before, 3 frames after
        context_before = log_mel[i - context_frames:i]
        context_after = log_mel[i + 1:i + context_frames + 1]
        
        # Flatten and concatenate
        x_sample = np.concatenate((context_before.flatten(), context_after.flatten()))
        y_sample = log_mel[i]
        
        X.append(x_sample)
        y.append(y_sample)
        
    return np.array(X), np.array(y)
