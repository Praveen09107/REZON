import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface NetworkGraphProps {
  telemetry: any;
}

export function NetworkGraph({ telemetry }: NetworkGraphProps) {
  // We'll spawn a "packet" animation every time telemetry updates
  const [packets, setPackets] = useState<{ id: string; path: string }[]>([]);

  useEffect(() => {
    if (!telemetry) return;
    
    // Spawn packets moving along 3 different paths
    const now = Date.now();
    const rand = Math.random();
    const newPackets = [
      { id: `${now}-${rand}-1`, path: "edge-to-cloud" },
      { id: `${now}-${rand}-2`, path: "cloud-to-agent" },
    ];
    
    setPackets(prev => [...prev, ...newPackets].slice(-10)); // Keep max 10
  }, [telemetry]);

  const isAnomalous = telemetry && telemetry.fused_score > 0.7;

  return (
    <div className="w-full h-[280px] bg-[#050505] rounded-2xl border border-border/50 relative overflow-hidden flex items-center justify-center">
      
      {/* Grid Background */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:20px_20px]" />
      
      <svg className="w-full h-full absolute inset-0 z-10" viewBox="0 0 400 280">
        <defs>
          <linearGradient id="line-glow" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.2" />
            <stop offset="50%" stopColor="#06b6d4" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.2" />
          </linearGradient>
          <filter id="glow">
            <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>

        {/* Lines */}
        <path d="M 100,140 Q 200,80 300,100" fill="none" stroke="url(#line-glow)" strokeWidth="2" strokeDasharray="5,5" className={isAnomalous ? 'animate-pulse stroke-warning' : ''} />
        <path d="M 100,140 Q 200,200 300,180" fill="none" stroke="url(#line-glow)" strokeWidth="2" strokeDasharray="5,5" />
        <path d="M 300,100 L 300,180" fill="none" stroke="url(#line-glow)" strokeWidth="1" opacity="0.3" />

        {/* Packets */}
        <AnimatePresence>
          {packets.map(p => {
            if (p.path === "edge-to-cloud") {
              return (
                <motion.circle
                  key={p.id}
                  r="3"
                  fill="#fff"
                  filter="url(#glow)"
                  initial={{ cx: 100, cy: 140, opacity: 1 }}
                  animate={{ cx: 300, cy: 100, opacity: 0 }}
                  transition={{ duration: 1, ease: "linear" }}
                />
              );
            }
            if (p.path === "cloud-to-agent") {
              return (
                <motion.circle
                  key={p.id}
                  r="3"
                  fill="#06b6d4"
                  filter="url(#glow)"
                  initial={{ cx: 300, cy: 100, opacity: 1 }}
                  animate={{ cx: 300, cy: 180, opacity: 0 }}
                  transition={{ duration: 0.5, ease: "linear", delay: 1 }}
                />
              );
            }
            return null;
          })}
        </AnimatePresence>

        {/* Nodes */}
        {/* Edge Node */}
        <g transform="translate(100, 140)">
          <circle r="20" fill="#1e293b" stroke={isAnomalous ? "#ef4444" : "#06b6d4"} strokeWidth="2" filter="url(#glow)" />
          <text x="0" y="-30" fill="#94a3b8" fontSize="10" textAnchor="middle" className="font-mono">EDGE:REZON-01</text>
          <circle r="4" fill={isAnomalous ? "#ef4444" : "#06b6d4"} className="animate-ping" />
        </g>
        
        {/* Cloud Ingestion */}
        <g transform="translate(300, 100)">
          <rect x="-25" y="-15" width="50" height="30" rx="5" fill="#1e293b" stroke="#8b5cf6" strokeWidth="2" filter="url(#glow)" />
          <text x="0" y="-25" fill="#94a3b8" fontSize="10" textAnchor="middle" className="font-mono">CLOUD_INGEST</text>
          <circle r="3" fill="#8b5cf6" className="animate-pulse" />
        </g>

        {/* Agent Node */}
        <g transform="translate(300, 180)">
          <polygon points="0,-15 15,10 -15,10" fill="#1e293b" stroke="#10b981" strokeWidth="2" filter="url(#glow)" />
          <text x="0" y="25" fill="#94a3b8" fontSize="10" textAnchor="middle" className="font-mono">AGENT_SWARM</text>
        </g>
      </svg>
    </div>
  );
}
