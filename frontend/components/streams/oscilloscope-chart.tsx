import { useEffect, useRef } from "react";
import { Activity } from "lucide-react";

interface OscilloscopeChartProps {
  data: any[];
  scoreKey: string;
  label: string;
  color: string;
}

export function OscilloscopeChart({ data, scoreKey, label, color }: OscilloscopeChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const draw = () => {
      const width = canvas.width;
      const height = canvas.height;

      // Clear the canvas with a slight trail effect
      ctx.fillStyle = "rgba(5, 5, 5, 0.2)";
      ctx.fillRect(0, 0, width, height);

      // Draw Grid
      ctx.strokeStyle = "rgba(255, 255, 255, 0.05)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let x = 0; x < width; x += 40) {
        ctx.moveTo(x, 0); ctx.lineTo(x, height);
      }
      for (let y = 0; y < height; y += 40) {
        ctx.moveTo(0, y); ctx.lineTo(width, y);
      }
      ctx.stroke();

      if (data.length === 0) return;

      // Draw Line
      ctx.beginPath();
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.shadowBlur = 10;
      ctx.shadowColor = color;
      ctx.lineJoin = "round";

      const step = width / (data.length - 1);
      
      data.forEach((point, i) => {
        const val = point[scoreKey] ?? 0;
        // The scores are typically 0 to 1, we invert Y for canvas
        const y = height - (val * height * 0.8) - (height * 0.1); // padding
        const x = i * step;

        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });

      ctx.stroke();
      
      // Reset shadow for performance
      ctx.shadowBlur = 0;
    };

    // Use requestAnimationFrame for smooth drawing
    let animationFrameId: number;
    const render = () => {
      draw();
      animationFrameId = requestAnimationFrame(render);
    };
    render();

    return () => cancelAnimationFrame(animationFrameId);
  }, [data, scoreKey, color]);

  const latestVal = data.length > 0 ? (data[data.length - 1][scoreKey] ?? 0) : 0;
  const isAnomalous = latestVal > 0.8;

  return (
    <div className="relative w-full h-[180px] bg-[#050505] rounded-2xl border border-border/50 overflow-hidden flex flex-col group">
      
      {/* Header overlay */}
      <div className="absolute top-0 left-0 right-0 p-3 z-10 flex justify-between items-start pointer-events-none">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-surface-2 rounded-lg border border-border/50 shadow-lg backdrop-blur">
            <Activity className="w-4 h-4" style={{ color }} />
          </div>
          <span className="text-xs font-bold text-white uppercase tracking-widest bg-black/50 px-2 py-0.5 rounded backdrop-blur">
            {label}
          </span>
        </div>
        <div className="flex flex-col items-end">
          <span className={`text-xl font-mono font-black ${isAnomalous ? 'text-danger animate-pulse' : 'text-white'} bg-black/50 px-2 py-0.5 rounded backdrop-blur`}>
            {latestVal.toFixed(3)}
          </span>
          {isAnomalous && (
             <span className="text-[10px] text-danger font-bold uppercase tracking-widest mt-1 bg-danger/10 border border-danger/30 px-1.5 rounded">
               ANOMALY DETECTED
             </span>
          )}
        </div>
      </div>

      <canvas 
        ref={canvasRef}
        width={600}
        height={180}
        className="w-full h-full block"
      />
      
      {/* HUD scanline overlay */}
      <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%)] bg-[length:100%_4px] opacity-50 mix-blend-overlay" />
    </div>
  );
}
