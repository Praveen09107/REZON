import torch
import torch.nn as nn

class IDNN(nn.Module):
    """
    IDNN (Inverse Deep Neural Network) for audio anomaly detection.
    Matches the architecture specified in AI/ML Spec Section 2.
    Input: 240 values (40 mel bins x 6 context frames)
    Output: 40 values (predicted center frame mel bins)
    """
    def __init__(self, input_dim=240, bottleneck_dim=16, output_dim=40):
        super(IDNN, self).__init__()
        
        self.encoder = nn.Sequential(
            nn.Linear(input_dim, 128),
            nn.ReLU(),
            nn.Linear(128, 64),
            nn.ReLU(),
            nn.Linear(64, bottleneck_dim),
            nn.ReLU()
        )
        
        self.decoder = nn.Sequential(
            nn.Linear(bottleneck_dim, 64),
            nn.ReLU(),
            nn.Linear(64, 128),
            nn.ReLU(),
            nn.Linear(128, output_dim)
        )

    def forward(self, x):
        encoded = self.encoder(x)
        decoded = self.decoder(encoded)
        return decoded

def compute_anomaly_score(predicted, actual):
    """
    Anomaly score is the mean squared error between predicted and actual center frame.
    """
    return torch.nn.functional.mse_loss(predicted, actual, reduction='none').mean(dim=1)
