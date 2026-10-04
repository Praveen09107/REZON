import { useEffect, useState } from "react";
import { Crosshair, AlertTriangle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface CCTVFeedProps {
  telemetry: any;
}

export function CCTVFeed({ telemetry }: CCTVFeedProps) {
  const [glitch, setGlitch] = useState(false);

  const isAnomalous = telemetry && telemetry.fused_score > 0.7;
  const isCritical = telemetry && telemetry.fused_score > 0.85;

  // Trigger random glitch effects when anomalous
  useEffect(() => {
    if (!isAnomalous) return;
    const interval = setInterval(() => {
      setGlitch(true);
      setTimeout(() => setGlitch(false), 150);
    }, Math.random() * 2000 + 500);
    return () => clearInterval(interval);
  }, [isAnomalous]);

  // Determine which component is failing based on modalities
  let targetLabel = "MONITORING";
  let targetProb = 0;
  if (telemetry) {
    if (telemetry.vibration_score > 0.5 || telemetry.audio_score > 0.5) { 
      targetLabel = "BEARING SPALLING (BPFO)"; 
      targetProb = Math.min(99, Math.round(88 + (telemetry.vibration_score * 11))); 
    }
    else if (telemetry.env_score > 0.5 || telemetry.env_temp > 35) { 
      targetLabel = "THERMAL OVERLOAD"; 
      targetProb = Math.min(99, Math.round(86 + (telemetry.env_score * 12))); 
    }
    else if (telemetry.gas_score > 0.5) { 
      targetLabel = "VOC / GAS COMBUSTION"; 
      targetProb = Math.min(99, Math.round(90 + (telemetry.gas_score * 9))); 
    }
    else if (telemetry.current_score > 0.5) { 
      targetLabel = "STATOR OVERCURRENT"; 
      targetProb = Math.min(99, Math.round(85 + (telemetry.current_score * 13))); 
    }
  }

  return (
    <div className="relative w-full h-[280px] bg-[#0a0a0c] rounded-2xl border border-border/50 overflow-hidden font-mono group">
      
      {/* Background Graphic (Simulated Asset) */}
      <div className={`absolute inset-0 bg-center bg-cover bg-no-repeat opacity-40 transition-transform duration-1000 ${isCritical ? 'scale-110' : 'scale-100'}`} 
           style={{ backgroundImage: 'radial-gradient(circle at center, #1f2937 0%, #030712 100%)' }}>
        {/* We use CSS gradients to draw a fake machine shape */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-48 h-32 bg-surface border border-white/10 rounded-lg shadow-2xl relative">
            <div className="absolute -left-8 top-8 w-12 h-16 bg-surface-2 rounded border border-white/5" />
            <div className="absolute -right-12 top-6 w-16 h-20 bg-surface-2 rounded-full border border-white/5 flex items-center justify-center">
              <div className={`w-8 h-8 rounded-full border-4 border-dashed ${isAnomalous ? 'border-warning animate-[spin_0.5s_linear_infinite]' : 'border-calm animate-[spin_2s_linear_infinite]'}`} />
            </div>
          </div>
        </div>
      </div>

      {/* CRT Scanline Effect */}
      <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[length:100%_4px,3px_100%] z-10" />
      
      {/* Glitch Overlay */}
      {glitch && (
        <div className="absolute inset-0 bg-white mix-blend-overlay opacity-20 z-20" />
      )}

      {/* Camera HUD Overlays */}
      <div className="absolute top-4 left-4 z-30 flex items-center gap-2">
        <div className="w-2 h-2 rounded-full bg-danger animate-pulse" />
        <span className="text-[10px] text-white tracking-widest font-bold">REC</span>
        <span className="text-[10px] text-white/50 ml-2">CAM-04 : SECTOR A</span>
      </div>

      <div className="absolute top-4 right-4 z-30 text-[10px] text-white/50 text-right">
        <div>{new Date().toISOString()}</div>
        <div>FPS: 59.94</div>
      </div>

      {/* AI Vision Bounding Box */}
      <AnimatePresence>
        {isAnomalous && (
          <motion.div 
            initial={{ opacity: 0, scale: 1.2 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="absolute z-30 border-2 border-danger shadow-[0_0_15px_rgba(239,68,68,0.5)]"
            style={{ 
              top: '30%', left: '40%', width: '120px', height: '100px',
              // Glitchy movement if critical
              transform: isCritical && glitch ? 'translate(4px, -2px)' : 'none'
            }}
          >
            {/* Crosshairs */}
            <Crosshair className="absolute -top-3 -left-3 w-6 h-6 text-danger" />
            <Crosshair className="absolute -bottom-3 -right-3 w-6 h-6 text-danger" />
            
            {/* Target Label */}
            <div className="absolute -top-6 left-0 bg-danger text-black text-[9px] font-black px-1.5 py-0.5 flex items-center gap-1 whitespace-nowrap">
              <AlertTriangle className="w-3 h-3" />
              TARGET LOCKED: {targetLabel} ({targetProb}%)
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Reticle / Center indicator */}
      {!isAnomalous && (
        <div className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none opacity-20">
          <Crosshair className="w-32 h-32 text-calm" strokeWidth={0.5} />
        </div>
      )}
      
      {/* Dynamic Data Overlay */}
      <div className="absolute bottom-4 left-4 z-30 space-y-1">
        <div className="text-[10px] text-calm">OBJ_TRACKING: ACTIVE</div>
        <div className="text-[10px] text-calm">VISION_MODEL: v4.2.1-edge</div>
      </div>
    </div>
  );
}
