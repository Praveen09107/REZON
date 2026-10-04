import os
import time
import json
import requests
from datetime import datetime, timezone
from math_models import VirtualEnvironment

# Pointing to the Next.js Embedded SQLite API instead of Supabase
INGEST_URL = "http://localhost:3000/api/telemetry/ingest"
CONTROL_FILE = os.path.join(os.path.dirname(__file__), "..", "..", "frontend", "data", "control.json")

class VirtualEdgeSimulator:
    def __init__(self):
        self.env = VirtualEnvironment()
        self.seq_number = 1
        self.scenario_file = os.path.join(os.path.dirname(__file__), "..", "..", "frontend", "data", "control.json")
        
        # Initialize default scenario file
        with open(self.scenario_file, "w") as f:
            json.dump({"scenario": None}, f)
            
    def check_for_scenarios(self):
        """Reads control.json to act as a lightweight Control Panel API"""
        try:
            if not os.path.exists(self.scenario_file):
                return
            with open(self.scenario_file, "r") as f:
                data = json.load(f)
                scenario = data.get("scenario")
                
            # If scenario was set to None/null or "reset", reset the environment
            if not scenario or scenario == "reset" or scenario == "null":
                if self.env.anomaly_scenario is not None:
                    print("[*] Scenario cleared/reset -> Returning to nominal physical state.")
                    self.env = VirtualEnvironment()
                    with open(self.scenario_file, "w") as fw:
                        json.dump({"scenario": None, "status": "idle"}, fw)
            elif scenario and scenario != self.env.anomaly_scenario:
                print(f"[*] Activating anomaly scenario: {scenario}")
                self.env.inject_scenario(scenario)
                with open(self.scenario_file, "w") as fw:
                    json.dump({"scenario": scenario, "status": "running"}, fw)
        except Exception as e:
            pass # Ignore read errors during concurrent write

    def tick(self):
        """Generates one frame of data and pushes it to Supabase"""
        self.check_for_scenarios()
        
        # Generate organic sensor scores
        audio = self.env.generate_audio_score()
        vib = self.env.generate_vibration_score()
        temp, hum, press, env_score = self.env.generate_environment()
        gas = self.env.generate_gas_score()
        current = self.env.generate_current_score()
        
        # 2-of-N Corroboration / Fusion
        fused = self.env.compute_fusion([audio, vib, env_score, gas, current])
        
        # Safety Logic Evaluation
        event = None
        alert_threshold = 0.65
        actuation_threshold = 0.85
        
        if fused > actuation_threshold:
            event = {
                "type": "actuation",
                "contributing_modalities": {
                    "audio": audio, "vibration": vib, "env": env_score, "gas": gas, "current": current
                }
            }
            print(f"[!] ACTUATION TRIGGERED! Fused: {fused:.3f}")
            # Keep motor in stressed state during demo scenario so visual failure cascade remains visible
        elif fused > alert_threshold:
            event = {
                "type": "alert",
                "contributing_modalities": {
                    "audio": audio, "vibration": vib, "env": env_score, "gas": gas, "current": current
                }
            }
            print(f"[*] Alert Triggered. Fused: {fused:.3f}")
            
        # Construct exact payload required by B.3 Cloud Spec
        payload = {
            "seq_number": self.seq_number,
            "recorded_at": datetime.now(timezone.utc).isoformat(),
            "audio_score": audio,
            "vibration_score": vib,
            "env_score": env_score,
            "gas_score": gas,
            "current_score": current,
            "env_temp": temp,
            "env_humidity": hum,
            "env_pressure": press,
            "fused_score": fused,
            "event": event,
            # Virtual Device Health Metrics
            "free_heap_bytes": 145000 - int(self.env.get_time_delta() % 1000),
            "psram_used_bytes": 1050000 + int(self.env.get_time_delta() % 5000),
            "psram_total_bytes": 8388608,
            "wifi_rssi_dbm": -55 + int(self.env.get_time_delta() % 5),
            "sd_buffer_minutes": 0
        }
        
        print(f"Tick {self.seq_number} | Fused: {fused:.3f} | Motor: {'ON' if self.env.motor_running else 'OFF'} | Temp: {temp}C")
        
        headers = {
            "Content-Type": "application/json"
        }
        
        try:
            res = requests.post(INGEST_URL, json=payload, headers=headers, timeout=2)
            if res.status_code not in (200, 201):
                print(f"[-] HTTP {res.status_code}: {res.text}")
        except Exception as e:
            print(f"[-] Connection Error: {e}")
            
        self.seq_number += 1

if __name__ == "__main__":
    print("========================================")
    print(" REZON Stateful Virtual Edge Simulator ")
    print("========================================")
    print(f"Targeting: {INGEST_URL}")
    print("Running math models... Press Ctrl+C to exit.\n")
    
    sim = VirtualEdgeSimulator()
    try:
        while True:
            sim.tick()
            time.sleep(1.0) # 1Hz cadence as specified in ADD
    except KeyboardInterrupt:
        print("\nSimulator stopped.")
