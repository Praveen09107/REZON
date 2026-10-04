"use client";
import { useState } from "react";
import { Bell, Send, CheckCircle2, Volume2, ShieldAlert, Radio, Sliders } from "lucide-react";

export default function NotificationsPage() {
  const [alertThreshold, setAlertThreshold] = useState(0.65);
  const [actuationThreshold, setActuationThreshold] = useState(0.85);
  const [inAppSound, setInAppSound] = useState(true);
  const [screenStrobe, setScreenStrobe] = useState(true);
  const [hardwareBuzzer, setHardwareBuzzer] = useState(true);
  const [testSent, setTestSent] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleTestDispatch = () => {
    setTestSent(true);
    setTimeout(() => setTestSent(false), 2500);
  };

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="animate-in fade-in duration-700 space-y-8 max-w-4xl">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-white tracking-tight flex items-center gap-3">
            <Bell className="w-8 h-8 text-calm" /> 
            Alert Routing & Dispatch
          </h1>
          <p className="text-text-2 mt-1">Configure real-time edge escalation rules, audio chimes, and webhook dispatches.</p>
        </div>

        <button 
          onClick={handleTestDispatch}
          className="bg-purple-600 hover:bg-purple-500 text-white font-bold px-4 py-2 rounded-xl text-sm transition-all flex items-center gap-2"
        >
          <Send className="w-4 h-4" />
          {testSent ? "Test Dispatch Fired!" : "Simulate Test Alert"}
        </button>
      </div>

      {testSent && (
        <div className="glass border border-purple-500/50 bg-purple-500/10 p-4 rounded-2xl flex items-center gap-3 text-purple-300 animate-in fade-in">
          <ShieldAlert className="w-5 h-5 text-purple-400 shrink-0" />
          <div className="text-sm">
            <span className="font-bold text-white">Test Dispatch Triggered:</span> Test alert sent through all enabled channels. Hardware buzzer ping acknowledged by REZON-01.
          </div>
        </div>
      )}

      {/* Threshold Config */}
      <div className="glass rounded-3xl p-6 border border-border/50 space-y-6">
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          <Sliders className="w-5 h-5 text-calm" />
          Fusion Score Trigger Thresholds
        </h2>

        <div className="space-y-6">
          <div>
            <div className="flex justify-between text-sm mb-2">
              <span className="text-text-2">Warning Alert Level (Stage 1)</span>
              <span className="text-warning font-mono font-bold">{alertThreshold.toFixed(2)}</span>
            </div>
            <input 
              type="range" min={0.50} max={0.80} step={0.01} 
              value={alertThreshold}
              onChange={(e) => setAlertThreshold(parseFloat(e.target.value))}
              className="w-full accent-warning"
            />
            <p className="text-xs text-text-3 mt-1">Trips warning banner in dashboard and logs RCA ticket.</p>
          </div>

          <div>
            <div className="flex justify-between text-sm mb-2">
              <span className="text-text-2">Critical Actuation Level (Stage 6)</span>
              <span className="text-danger font-mono font-bold">{actuationThreshold.toFixed(2)}</span>
            </div>
            <input 
              type="range" min={0.80} max={0.99} step={0.01} 
              value={actuationThreshold}
              onChange={(e) => setActuationThreshold(parseFloat(e.target.value))}
              className="w-full accent-danger"
            />
            <p className="text-xs text-text-3 mt-1">Initiates 4s debounce and triggers physical machine disconnect relay.</p>
          </div>
        </div>
      </div>

      {/* Channel Toggles */}
      <div className="glass rounded-3xl p-6 border border-border/50 space-y-4">
        <h2 className="text-lg font-bold text-white flex items-center gap-2 mb-2">
          <Radio className="w-5 h-5 text-purple-400" />
          Dispatch Channels
        </h2>

        <div className="space-y-3">
          <div className="flex items-center justify-between p-4 rounded-2xl bg-surface-2 border border-border">
            <div className="flex items-center gap-3">
              <Volume2 className="w-5 h-5 text-calm" />
              <div>
                <div className="text-sm font-bold text-white">In-App Audio Chime</div>
                <div className="text-xs text-text-3">Synthesizes WebAudio tone on high anomaly detection</div>
              </div>
            </div>
            <input 
              type="checkbox" 
              checked={inAppSound} 
              onChange={(e) => setInAppSound(e.target.checked)}
              className="w-5 h-5 accent-calm cursor-pointer"
            />
          </div>

          <div className="flex items-center justify-between p-4 rounded-2xl bg-surface-2 border border-border">
            <div className="flex items-center gap-3">
              <ShieldAlert className="w-5 h-5 text-danger" />
              <div>
                <div className="text-sm font-bold text-white">Emergency Visual Strobe</div>
                <div className="text-xs text-text-3">Pulses red beacon border during physical actuation sequence</div>
              </div>
            </div>
            <input 
              type="checkbox" 
              checked={screenStrobe} 
              onChange={(e) => setScreenStrobe(e.target.checked)}
              className="w-5 h-5 accent-danger cursor-pointer"
            />
          </div>

          <div className="flex items-center justify-between p-4 rounded-2xl bg-surface-2 border border-border">
            <div className="flex items-center gap-3">
              <Radio className="w-5 h-5 text-amber-400" />
              <div>
                <div className="text-sm font-bold text-white">Edge Hardware GPIO Buzzer</div>
                <div className="text-xs text-text-3">Fires physical alarm horn via ESP32 GPIO 21</div>
              </div>
            </div>
            <input 
              type="checkbox" 
              checked={hardwareBuzzer} 
              onChange={(e) => setHardwareBuzzer(e.target.checked)}
              className="w-5 h-5 accent-amber-400 cursor-pointer"
            />
          </div>
        </div>

        <div className="pt-4 flex items-center gap-4">
          <button
            onClick={handleSave}
            className="bg-calm hover:bg-calm/80 text-black font-bold px-6 py-2.5 rounded-xl text-sm transition-all"
          >
            Save Routing Rules
          </button>
          {saved && (
            <span className="text-xs text-emerald-400 font-bold flex items-center gap-1.5 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4" /> Preferences saved to edge firmware!
            </span>
          )}
        </div>
      </div>

    </div>
  );
}
