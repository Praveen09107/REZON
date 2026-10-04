import { useEffect, useState, useRef } from "react";
import { Terminal } from "lucide-react";

interface HexDumpProps {
  telemetry: any;
}

export function HexDump({ telemetry }: HexDumpProps) {
  const [lines, setLines] = useState<string[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  // Convert telemetry object to a fake hex payload
  useEffect(() => {
    if (!telemetry) return;
    
    // Convert telemetry to JSON string, then create a fake hex representation
    const jsonStr = JSON.stringify(telemetry);
    let hexStr = "";
    for (let i = 0; i < jsonStr.length; i++) {
      hexStr += jsonStr.charCodeAt(i).toString(16).padStart(2, '0') + " ";
    }
    
    const timestamp = new Date().toISOString().split('T')[1].replace('Z', '');
    const memoryAddress = Math.floor(Math.random() * 0xFFFFFF).toString(16).padStart(8, '0').toUpperCase();
    
    const newLine = `[${timestamp}] 0x${memoryAddress}  ${hexStr.substring(0, 48)}...`;
    
    setLines(prev => {
      const next = [...prev, newLine];
      if (next.length > 50) return next.slice(next.length - 50);
      return next;
    });
  }, [telemetry]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [lines]);

  return (
    <div className="w-full h-full bg-[#050505] rounded-2xl border border-border/50 p-4 flex flex-col overflow-hidden relative">
      <div className="flex items-center justify-between mb-3 border-b border-border/50 pb-2">
        <h3 className="text-xs font-bold text-white uppercase tracking-widest flex items-center gap-2">
          <Terminal className="w-4 h-4 text-calm" /> Raw Hex Ingress
        </h3>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-[10px] text-emerald-400 font-mono">SOCKET_OPEN</span>
        </div>
      </div>
      
      <div 
        ref={containerRef}
        className="flex-1 overflow-y-auto font-mono text-[9px] leading-tight text-text-3 space-y-1 hide-scrollbar"
      >
        <div className="text-calm opacity-50 mb-2">
          {"//"} INITIALIZING DIRECT MEMORY ACCESS TO EDGE NODE...<br/>
          {"//"} LISTENING ON PORT 8042...
        </div>
        
        {lines.map((line, i) => {
          // Highlight anomalies in red
          const isDanger = telemetry?.fused_score > 0.8 && i >= lines.length - 2;
          return (
            <div key={i} className={isDanger ? "text-danger font-bold" : "text-text-3"}>
              {line}
            </div>
          );
        })}
      </div>
      
      <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-[#050505] to-transparent pointer-events-none" />
    </div>
  );
}
