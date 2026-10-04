import os
import time
import requests
from datetime import datetime, timedelta, timezone
from math_models import VirtualEnvironment

# Pointing to the Next.js Embedded SQLite API instead of Supabase
INGEST_URL = "http://localhost:3000/api/telemetry/ingest"

def run_burn_in():
    print("========================================")
    print(" REZON Virtual Burn-In Data Generator")
    print("========================================")
    
    env = VirtualEnvironment()
    seq = 100000 # Start high so we don't collide with live seq numbers starting at 1
    
    now = datetime.now(timezone.utc)
    start_time = now - timedelta(days=14)
    
    # Generate Sparse Historical Data (Last 14 days to 1 hour ago) - every 30 mins
    print("[*] Generating 14-day historical data (Sparse)...")
    current_time = start_time
    sparse_count = 0
    
    headers = {
        "Content-Type": "application/json"
    }

    # Helper to push a payload
    def push_point(timestamp, env, seq_num):
        audio = env.generate_audio_score()
        vib = env.generate_vibration_score()
        temp, hum, press, env_score = env.generate_environment()
        gas = env.generate_gas_score()
        current = env.generate_current_score()
        fused = env.compute_fusion([audio, vib, env_score, gas, current])
        
        payload = {
            "seq_number": seq_num,
            "recorded_at": timestamp.isoformat(),
            "audio_score": audio, "vibration_score": vib, "env_score": env_score,
            "gas_score": gas, "current_score": current,
            "env_temp": temp, "env_humidity": hum, "env_pressure": press,
            "fused_score": fused, "event": None,
            "free_heap_bytes": 145000, "psram_used_bytes": 1050000,
            "psram_total_bytes": 8388608, "wifi_rssi_dbm": -55,
            "sd_buffer_minutes": 0
        }
        try:
            requests.post(INGEST_URL, json=payload, headers=headers, timeout=5)
        except Exception:
            pass # ignore timeouts for speed

    while current_time < now - timedelta(hours=1):
        push_point(current_time, env, seq)
        # Advance simulation math time
        env.start_time -= 1800 # 30 mins
        current_time += timedelta(minutes=30)
        seq += 1
        sparse_count += 1
        if sparse_count % 100 == 0:
            print(f"  ... pushed {sparse_count} sparse points")
            
    # Generate Dense Data (Last 1 hour) - every 5 seconds
    print("[*] Generating 1-hour recent data (Dense)...")
    dense_count = 0
    current_time = now - timedelta(hours=1)
    
    while current_time <= now:
        push_point(current_time, env, seq)
        env.start_time -= 5
        current_time += timedelta(seconds=5)
        seq += 1
        dense_count += 1
        if dense_count % 100 == 0:
            print(f"  ... pushed {dense_count} dense points")

    print(f"\n[+] Burn-in Complete! Pushed {sparse_count} historical points and {dense_count} recent points.")

if __name__ == "__main__":
    run_burn_in()
