import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import DataLoader, TensorDataset
from model import IDNN

def train_idnn(X_train, y_train, epochs=50, batch_size=32, lr=1e-3):
    """
    Train the Inverse Deep Neural Network (IDNN).
    X_train: shape (num_samples, 240)
    y_train: shape (num_samples, 40)
    """
    # Convert numpy arrays to tensors
    X_tensor = torch.tensor(X_train, dtype=torch.float32)
    y_tensor = torch.tensor(y_train, dtype=torch.float32)
    
    dataset = TensorDataset(X_tensor, y_tensor)
    dataloader = DataLoader(dataset, batch_size=batch_size, shuffle=True)
    
    model = IDNN()
    criterion = nn.MSELoss()
    optimizer = optim.Adam(model.parameters(), lr=lr)
    
    model.train()
    
    print(f"Training IDNN for {epochs} epochs...")
    for epoch in range(epochs):
        epoch_loss = 0.0
        for batch_X, batch_y in dataloader:
            optimizer.zero_grad()
            
            # Forward pass
            predictions = model(batch_X)
            loss = criterion(predictions, batch_y)
            
            # Backward pass and optimize
            loss.backward()
            optimizer.step()
            
            epoch_loss += loss.item()
            
        avg_loss = epoch_loss / len(dataloader)
        if (epoch + 1) % 10 == 0 or epoch == 0:
            print(f"Epoch {epoch+1}/{epochs}, Loss: {avg_loss:.6f}")
            
    print("Training complete.")
    return model

if __name__ == "__main__":
    # Dummy data test
    X_dummy = torch.randn(100, 240).numpy()
    y_dummy = torch.randn(100, 40).numpy()
    trained_model = train_idnn(X_dummy, y_dummy, epochs=10)
    
    # Save the model
    torch.save(trained_model.state_dict(), "idnn_model.pth")
    print("Model saved to idnn_model.pth")
