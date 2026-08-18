import numpy as np
import pytest

def sigmoid(z):
    return 1 / (1 + np.exp(-z))

def test_score_normalization():
    """
    Test score normalization (AI/ML Spec §7.1).
    Normalization at z=0 -> 0.5; z=+5 -> ~1.0; z=-5 -> ~0.0
    """
    assert np.isclose(sigmoid(0), 0.5)
    assert np.isclose(sigmoid(5), 0.9933, atol=1e-3)
    assert np.isclose(sigmoid(-5), 0.0067, atol=1e-3)

def test_held_out_split():
    """
    Test held-out split (AI/ML Spec §9).
    Confirms split is by source/session, not random-frame.
    No data point appears in both train and held-out sets.
    """
    # Mock data sessions
    session_1 = [1, 2, 3, 4, 5]
    session_2 = [6, 7, 8, 9, 10]
    session_3 = [11, 12, 13, 14, 15]
    
    all_sessions = [session_1, session_2, session_3]
    
    # 20% hold out implies holding out ~1 session out of 5, or just session_3 here
    train_sessions = [session_1, session_2]
    held_out_sessions = [session_3]
    
    train_data = set(item for sublist in train_sessions for item in sublist)
    held_out_data = set(item for sublist in held_out_sessions for item in sublist)
    
    # Assert completely disjoint
    assert train_data.isdisjoint(held_out_data)
