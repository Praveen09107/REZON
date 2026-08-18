import time
import json
import random
import datetime
from local_mlops.supabase_client import get_local_tier_client

def generate_mock_telemetry(device_id: str, seq: int) -> dict:
    """Generate a realistic mock telemetry row simulating normal operation."""
    # Base normal distributions for each modality
    return {
        "device_id": device_id,
        "seq_number": seq,
        "recorded_at": datetime.datetime.now().isoformat(),
        "audio_score": max(0, min(1, random.gauss(0.1, 0.05))),
        "vibration_score": max(0, min(1, random.gauss(0.15, 0.02))),
        "env_score": max(0, min(1, random.gauss(0.05, 0.01))),
        "gas_score": max(0, min(1, random.gauss(0.2, 0.08))),
        "current_score": max(0, min(1, random.gauss(0.1, 0.03))),
        "env_temp": random.gauss(22.0, 0.5),
        "env_humidity": random.gauss(45.0, 2.0),
        "env_pressure": random.gauss(1013.25, 1.0),
        "fused_score": max(0, min(1, random.gauss(0.12, 0.04))),
    }

def run_mock_burn_in(num_events: int = 100, interval_sec: float = 1.0):
    print(f"Starting mock hardware burn-in simulation ({num_events} events)...")
    try:
        client = get_local_tier_client()
    except NotImplementedError:
        print("Supabase client dummy active — using local print stream instead of real network.")
        client = None

    device_id = "11111111-1111-1111-1111-111111111111"
    
    for i in range(num_events):
        row = generate_mock_telemetry(device_id, i)
        
        # In a real environment, we would insert this directly via supabase:
        # if client:
        #     client.table("telemetry").insert(row).execute()
            
        print(f"[{row['recorded_at']}] Seq {i} - Fused Score: {row['fused_score']:.3f} | Audio: {row['audio_score']:.3f}")
        time.sleep(interval_sec)
        
    print("Burn-in simulation complete. Data generated for MLOps stack end-to-end testing.")

if __name__ == "__main__":
    run_mock_burn_in(10, 0.1)  # small test run
