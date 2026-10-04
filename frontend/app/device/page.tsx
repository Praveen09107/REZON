"use client";
import { usePolledQuery } from "@/hooks/use-polled-data";
import { ResilienceWrapper } from "@/components/resilience-wrapper";
import { Box, Server, Signal, Battery, Clock, MapPin, Wrench } from "lucide-react";

interface DeviceRow {
  id: string; status: string; last_seen: string; 
  firmware_version: string; uptime_hours: number; battery_pct: number;
}

export default function DevicePage() {
  const { data, isLoading, dataUpdatedAt } = usePolledQuery<DeviceRow>(
    ["devices"], "device_registry", { orderBy: "id" }
  );

  return (
    <ResilienceWrapper lastUpdateMs={dataUpdatedAt} loading={isLoading}>
      <div className="animate-in fade-in duration-700 space-y-8">
        
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black text-white tracking-tight flex items-center gap-3">
              <Box className="w-8 h-8 text-blue-400" /> 
              Asset Registry
            </h1>
            <p className="text-text-2 mt-1">Manage physical edge hardware and digital twin mappings.</p>
          </div>
          <button className="bg-blue-500/10 text-blue-400 border border-blue-500/30 hover:bg-blue-500/20 transition-colors px-4 py-2 rounded-xl text-sm font-semibold flex items-center gap-2">
            <Server className="w-4 h-4" /> Provision New Asset
          </button>
        </div>

        <div className="grid grid-cols-1 gap-6">
          {(data ?? []).map((device) => (
            <div key={device.id} className="glass rounded-3xl p-6 border border-border/50 group hover:border-calm/50 transition-all duration-300">
              <div className="flex flex-col lg:flex-row justify-between gap-8">
                
                {/* Asset Identity */}
                <div className="flex items-start gap-5">
                  <div className="w-16 h-16 rounded-2xl bg-surface-2 border border-border flex items-center justify-center relative">
                    <div className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-emerald-500 border-2 border-[#0B0D14]" />
                    <Server className="w-8 h-8 text-text-2" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h2 className="text-2xl font-black text-white">{device.id.toUpperCase()}</h2>
                      <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 text-[10px] font-bold uppercase tracking-wider border border-emerald-500/20">
                        {device.status}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-text-3">
                      <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> Facility Alpha, Sector 4</span>
                      <span className="flex items-center gap-1"><Signal className="w-3 h-3" /> Last sync: {new Date(device.last_seen).toLocaleTimeString()}</span>
                    </div>
                  </div>
                </div>

                {/* Telemetry Vitals */}
                <div className="flex flex-wrap gap-6 items-center">
                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] uppercase font-bold tracking-widest text-text-3 flex items-center gap-1">
                      <Settings className="w-3 h-3" /> Firmware
                    </span>
                    <span className="text-sm font-mono text-white">{device.firmware_version}</span>
                  </div>
                  
                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] uppercase font-bold tracking-widest text-text-3 flex items-center gap-1">
                      <Clock className="w-3 h-3" /> Uptime
                    </span>
                    <span className="text-sm font-mono text-white">{device.uptime_hours}h</span>
                  </div>

                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] uppercase font-bold tracking-widest text-text-3 flex items-center gap-1">
                      <Battery className="w-3 h-3" /> Power
                    </span>
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-2 bg-surface-2 rounded-full overflow-hidden">
                          <div 
                            className={`h-full transition-all duration-1000 ${device.battery_pct > 20 ? 'bg-emerald-400' : 'bg-danger'}`} 
                            style={{ width: `${device.battery_pct}%` }}
                          />
                        </div>
                        <span className={`text-sm font-mono ${device.battery_pct > 20 ? 'text-emerald-400' : 'text-danger'}`}>
                          {device.battery_pct}%
                        </span>
                      </div>
                    </div>
                    
                    <div className="h-10 w-px bg-border hidden lg:block" />

                    <button className="bg-surface-2 hover:bg-surface-3 border border-border text-white px-4 py-2 rounded-xl text-sm font-semibold transition-colors flex items-center gap-2">
                      <Wrench className="w-4 h-4" /> Manage
                    </button>
                  </div>

                </div>
              </div>
          ))}
        </div>
      </div>
    </ResilienceWrapper>
  );
}

// Temporary inline import for the Settings icon since it wasn't in the destructured list
import { Settings } from "lucide-react";
