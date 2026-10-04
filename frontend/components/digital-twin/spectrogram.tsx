import { useEffect, useRef } from "react";

interface SpectrogramProps {
  telemetry: any;
}

export function Spectrogram({ telemetry }: SpectrogramProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // This maintains a history of frequency rows
  const historyRef = useRef<Uint8Array[]>([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // We simulate a 256-bin FFT array based on the current telemetry
    const bins = 128;
    const currentFrame = new Uint8Array(bins);
    
    let baseIntensity = 10;
    if (telemetry) {
      const vibScore = telemetry.vibration_score ?? 0.08;
      const audioScore = telemetry.audio_score ?? 0.09;
      
      for (let i = 0; i < bins; i++) {
        let val = Math.random() * 15 + baseIntensity;
        
        // Add fundamental motor rotation harmonic (approx 60Hz / bin 16)
        if (i > 14 && i < 18) val += 70;

        // Second rotational harmonic (120Hz / bin 32)
        if (i > 30 && i < 34) val += 35;
        
        // Low frequency mechanical vibration surge & sidebands during bearing/load fault
        if (vibScore > 0.3) {
          if ((i > 6 && i < 28) || (i > 45 && i < 65)) {
            val += vibScore * 140 * (Math.random() * 0.4 + 0.8);
          }
        }
        
        // High frequency bearing squeal & acoustic resonance (2.4kHz - 8kHz)
        if (audioScore > 0.3) {
          if (i > 70 && i < 118) {
            val += audioScore * 160 * (Math.sin(i * 0.3) * 0.3 + 0.8);
          }
        }
        
        currentFrame[i] = Math.min(255, val);
      }
    } else {
      for (let i = 0; i < bins; i++) {
        currentFrame[i] = Math.random() * 10;
      }
    }

    // Add to history, keep last 100 rows
    historyRef.current.unshift(currentFrame);
    if (historyRef.current.length > 100) {
      historyRef.current.pop();
    }

    // Draw the waterfall
    const width = canvas.width;
    const height = canvas.height;
    
    // Clear
    ctx.fillStyle = "#050505";
    ctx.fillRect(0, 0, width, height);
    
    const rowHeight = height / 100;
    const colWidth = width / bins;

    // Color map function (simple thermal/spectrogram map: dark -> blue -> green -> yellow -> red)
    const getColor = (val: number) => {
      const p = val / 255;
      if (p < 0.2) return `rgb(0, 0, ${p * 5 * 255})`; // Dark to Blue
      if (p < 0.5) return `rgb(0, ${(p - 0.2) * 3.33 * 255}, 255)`; // Blue to Cyan
      if (p < 0.8) return `rgb(${(p - 0.5) * 3.33 * 255}, 255, ${255 - (p - 0.5) * 3.33 * 255})`; // Cyan to Yellow
      return `rgb(255, ${255 - (p - 0.8) * 5 * 255}, 0)`; // Yellow to Red
    };

    historyRef.current.forEach((row, yIdx) => {
      for (let x = 0; x < bins; x++) {
        const val = row[x];
        if (val > 5) {
          ctx.fillStyle = getColor(val);
          ctx.fillRect(x * colWidth, yIdx * rowHeight, colWidth, rowHeight + 0.5);
        }
      }
    });

  }, [telemetry]); // Redraw whenever telemetry updates

  return (
    <div className="w-full h-full relative border border-border/50 rounded-2xl overflow-hidden bg-[#050505] flex flex-col">
      <div className="absolute top-2 left-3 z-10 text-[10px] uppercase font-bold text-calm tracking-widest bg-black/50 px-2 py-0.5 rounded">
        Acoustic Waterfall
      </div>
      <div className="absolute top-2 right-3 z-10 text-[10px] text-text-3 font-mono bg-black/50 px-2 py-0.5 rounded">
        0 - 20kHz
      </div>
      <canvas 
        ref={canvasRef} 
        width={400} 
        height={300} 
        className="w-full h-full object-fill"
      />
      
      {/* Frequency Axis Markers */}
      <div className="absolute bottom-0 left-0 right-0 h-4 bg-surface-2/80 border-t border-border flex justify-between px-2 items-center text-[8px] font-mono text-text-3">
        <span>0Hz</span>
        <span>5k</span>
        <span>10k</span>
        <span>15k</span>
        <span>20kHz</span>
      </div>
    </div>
  );
}
