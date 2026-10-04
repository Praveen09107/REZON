import time
import math

def smooth_noise(t, seed=0):
    """
    Approximates 1D Perlin noise by summing sine waves at different frequencies.
    Produces a smooth, continuous organic curve between -1.0 and 1.0.
    """
    wave1 = math.sin(t * 0.5 + seed * 10) 
    wave2 = math.sin(t * 1.3 + seed * 20) * 0.5
    wave3 = math.sin(t * 2.7 + seed * 30) * 0.25
    return (wave1 + wave2 + wave3) / 1.75

class VirtualEnvironment:
    """
    Maintains the state of the virtual physical environment and generates
    organic, continuous data using smooth procedural noise.
    """
    def __init__(self):
        self.start_time = time.time()
        self.motor_running = True
        self.anomaly_scenario = None
        self.scenario_start_time = 0
        self.base_temp = 22.0
        self.base_humidity = 45.0
        self.base_pressure = 1012.0

    def inject_scenario(self, scenario_name):
        self.anomaly_scenario = scenario_name
        self.scenario_start_time = time.time()
        print(f"[*] Injected Scenario: {scenario_name}")

    def get_time_delta(self):
        return time.time() - self.start_time

    def get_scenario_progress(self):
        if not self.anomaly_scenario:
            return 0.0
        # Fast responsive ramp over 6 seconds for immediate judging demonstration
        elapsed = time.time() - self.scenario_start_time
        return min(1.0, elapsed / 6.0)

    def generate_audio_score(self):
        t = self.get_time_delta()
        noise = smooth_noise(t * 0.1, seed=1) * 0.02
        score = 0.09 + noise
        p = self.get_scenario_progress()
        
        if self.anomaly_scenario == "bearing_failure":
            score += 0.82 * p
        elif self.anomaly_scenario == "false_alarm":
            score += 0.90 * p # Loud transient bang (dropped tool)
        elif self.anomaly_scenario == "fire":
            score += 0.55 * p
        elif self.anomaly_scenario == "power_surge":
            score += 0.65 * p
            
        return min(1.0, max(0.0, score))

    def generate_vibration_score(self):
        if not self.motor_running:
            return 0.01
            
        t = self.get_time_delta()
        noise = smooth_noise(t * 0.2, seed=2) * 0.015
        score = 0.08 + noise
        p = self.get_scenario_progress()
        
        if self.anomaly_scenario == "bearing_failure":
            chaotic_noise = smooth_noise(t * 2.0, seed=2) * 0.1 * p
            score += 0.85 * p + chaotic_noise
        elif self.anomaly_scenario == "power_surge":
            score += 0.78 * p
            
        return min(1.0, max(0.0, score))

    def generate_environment(self):
        t = self.get_time_delta()
        
        temp_noise = smooth_noise(t * 0.02, seed=3) * 0.8
        hum_noise = smooth_noise(t * 0.01, seed=4) * 2.0
        press_noise = smooth_noise(t * 0.05, seed=5) * 1.0
        
        temp = self.base_temp + temp_noise
        humidity = self.base_humidity + hum_noise
        pressure = self.base_pressure + press_noise
        
        env_score = 0.09 + (smooth_noise(t * 0.1, seed=6) * 0.015)
        p = self.get_scenario_progress()
        
        if self.anomaly_scenario == "overheating":
            temp += 32.0 * p
            env_score += 0.82 * p
        elif self.anomaly_scenario == "fire":
            temp += 45.0 * p
            env_score += 0.88 * p
            
        return (round(temp, 2), round(humidity, 2), round(pressure, 2), min(1.0, max(0.0, env_score)))

    def generate_gas_score(self):
        t = self.get_time_delta()
        score = 0.14 + (smooth_noise(t * 0.05, seed=7) * 0.02)
        p = self.get_scenario_progress()
        
        if self.anomaly_scenario in ("fire", "overheating"):
            score += 0.80 * p
            
        return min(1.0, max(0.0, score))

    def generate_current_score(self):
        if not self.motor_running:
            return 0.0
            
        t = self.get_time_delta()
        score = 0.11 + (smooth_noise(t * 0.8, seed=8) * 0.015)
        p = self.get_scenario_progress()
        
        if self.anomaly_scenario == "bearing_failure":
            score += 0.72 * p
        elif self.anomaly_scenario == "power_surge":
            score += 0.86 * p
        elif self.anomaly_scenario == "overheating":
            score += 0.58 * p
            
        return min(1.0, max(0.0, score))

    def compute_fusion(self, scores):
        """
        True 2-of-N Physical Sensor Corroboration:
        scores: [audio, vib, env_score, gas, current]
        
        Evaluates whether at least 2 distinct physical modalities corroborate an anomaly.
        """
        sorted_scores = sorted(scores, reverse=True)
        m1 = sorted_scores[0]
        m2 = sorted_scores[1]
        
        # 2-of-N Corroboration threshold is 0.38
        if m2 >= 0.38:
            # 2 or more sensors corroborate! High-confidence anomaly cascade.
            fused = 0.5 * (m1 + m2) + 0.08
            return min(0.96, max(0.0, fused))
        else:
            # 1-of-N isolation (e.g. transient acoustic false alarm, dropped tool)
            # System is immune to single-sensor spikes: fused score stays low
            fused = min(0.24, m2 * 1.4 + 0.04)
            return min(0.28, max(0.07, fused))
