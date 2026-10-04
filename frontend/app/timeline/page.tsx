"use client";
import { useState } from "react";
import { Clock, Activity, Target, Zap, Bot, Filter, Radio } from "lucide-react";
import { usePolledQuery } from "@/hooks/use-polled-data";

export default function TimelinePage() {
  const { data: timelineEvents = [] } = usePolledQuery<any>(['timeline'], 'timeline');
  const [selectedAgent, setSelectedAgent] = useState<string>("ALL");

  const agents = ["ALL", "Watcher", "Forecaster", "Operator", "Diagnostician"];

  const filteredEvents = selectedAgent === "ALL" 
    ? timelineEvents 
    : timelineEvents.filter((e: any) => e.agent?.toLowerCase() === selectedAgent.toLowerCase());

  return (
    <div className="animate-in fade-in duration-700 space-y-8">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-white tracking-tight flex items-center gap-3">
            <Clock className="w-8 h-8 text-calm" /> 
            Activity Timeline
          </h1>
          <p className="text-text-2 mt-1">Chronological audit log of all multi-agent actions and physical edge events.</p>
        </div>

        <div className="flex items-center gap-3">
          <div className="bg-surface border border-border rounded-xl px-3 py-1.5 flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
            </span>
            <span className="text-xs font-mono text-emerald-400 font-bold">1Hz LIVE INGEST</span>
          </div>
          <span className="text-xs text-text-3 font-mono">{filteredEvents.length} events logged</span>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs uppercase font-bold text-text-3 flex items-center gap-1.5 mr-2">
          <Filter className="w-3.5 h-3.5" /> Filter Agent:
        </span>
        {agents.map((agent) => (
          <button
            key={agent}
            onClick={() => setSelectedAgent(agent)}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              selectedAgent === agent
                ? "bg-calm text-black shadow-[0_0_15px_rgba(6,182,212,0.4)]"
                : "bg-surface-2 hover:bg-surface-3 text-text-2 border border-border"
            }`}
          >
            {agent}
          </button>
        ))}
      </div>

      {/* Timeline Stream */}
      <div className="glass rounded-3xl p-8 border border-border/50 max-w-4xl">
        <div className="relative border-l-2 border-border/30 ml-4 space-y-8 py-2">
          
          {filteredEvents.length === 0 ? (
            <div className="pl-8 text-text-3 text-sm py-4">
              Waiting for agent activity stream...
            </div>
          ) : (
            filteredEvents.map((event, idx) => {
              let Icon = Activity;
              if (event.type === 'alert') Icon = Target;
              if (event.type === 'critical') Icon = Zap;
              if (event.agent === 'Operator') Icon = Bot;

              const agentColor = 
                event.agent === 'Watcher' ? 'text-cyan-400 border-cyan-500/30 bg-cyan-500/10' :
                event.agent === 'Forecaster' ? 'text-amber-400 border-amber-500/30 bg-amber-500/10' :
                event.agent === 'Operator' ? 'text-purple-400 border-purple-500/30 bg-purple-500/10' :
                event.agent === 'Diagnostician' ? 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10' :
                'text-calm border-calm/30 bg-calm/10';
              
              return (
                <div key={event.id || idx} className="relative pl-8 group">
                  <div className="absolute -left-3.5 top-1">
                    <div className="bg-[#050505] p-1 rounded-full">
                      <div className={`w-5 h-5 rounded-full bg-surface-2 border border-border flex items-center justify-center group-hover:scale-125 transition-transform`}>
                        <Icon className={`w-3 h-3 ${event.color || 'text-calm'}`} />
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-mono text-text-3 font-semibold">{event.time}</span>
                      <span className={`text-[10px] uppercase font-bold tracking-widest px-2.5 py-0.5 rounded-full border ${agentColor}`}>
                        {event.agent} Agent
                      </span>
                      {event.type === 'critical' && (
                        <span className="text-[10px] uppercase font-black tracking-wider text-danger bg-danger/10 border border-danger/30 px-2 py-0.5 rounded-full animate-pulse">
                          CRITICAL
                        </span>
                      )}
                      {event.type === 'alert' && (
                        <span className="text-[10px] uppercase font-black tracking-wider text-warning bg-warning/10 border border-warning/30 px-2 py-0.5 rounded-full">
                          ALERT
                        </span>
                      )}
                    </div>
                    <div className="glass glass-hover p-4 rounded-2xl border border-border/50 transition-all hover:border-calm/30">
                      <p className="text-sm text-white font-medium">{event.msg}</p>
                    </div>
                  </div>
                </div>
              );
            })
          )}
          
        </div>
      </div>
    </div>
  );
}
