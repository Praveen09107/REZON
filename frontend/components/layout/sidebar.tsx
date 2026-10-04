"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useIsOperator } from "@/lib/auth-context";
import { 
  Globe, Activity, AlertOctagon, ShieldAlert, Clock, 
  LineChart, Workflow, History, GitCompare, FileText, CheckCircle2,
  Box, Settings2, Rocket, Bell, Shield, Settings, HelpCircle, Sparkles
} from "lucide-react";

const NAV_GROUPS = [
  { label: "Fleet Command", items: [
    { href: "/", label: "Global Overview", icon: Globe },
    { href: "/streams", label: "Live Diagnostics", icon: Activity },
    { href: "/incidents", label: "Triage & RCA", icon: AlertOctagon },
    { href: "/safety-chain", label: "Safety Chain", icon: ShieldAlert },
    { href: "/timeline", label: "Audit Timeline", icon: Clock },
  ]},
  { label: "Intelligence", items: [
    { href: "/prediction", label: "Anomaly Prediction", icon: Sparkles },
    { href: "/analytics", label: "Deep Analytics", icon: LineChart },
    { href: "/model", label: "Model Drift", icon: Workflow },
    { href: "/since-calibration", label: "Since Calibration", icon: History },
    { href: "/sandbox", label: "Threshold Sandbox", icon: GitCompare },
    { href: "/digest", label: "Shift Digest", icon: FileText },
    { href: "/trust-audit", label: "Trust Audit", icon: CheckCircle2 },
  ]},
  { label: "Operations", items: [
    { href: "/device", label: "Asset Registry", icon: Box },
    { href: "/calibration", label: "Sensor Calibration", icon: Settings2 },
    { href: "/deployments", label: "Edge Deployments", icon: Rocket },
    { href: "/notifications", label: "Routing Rules", icon: Bell },
    { href: "/access", label: "Access Control", icon: Shield, operatorOnly: true },
  ]},
  { label: "", items: [
    { href: "/settings", label: "System Config", icon: Settings },
    { href: "/help", label: "Documentation", icon: HelpCircle },
  ]},
];

export function Sidebar() {
  const pathname = usePathname();
  const isOperator = useIsOperator();

  return (
    <aside className="w-64 shrink-0 border-r border-border/50 bg-[#0B0D14]/80 backdrop-blur-3xl overflow-y-auto h-screen flex flex-col hide-scrollbar">
      <div className="sticky top-0 z-10 bg-gradient-to-b from-[#0B0D14] to-transparent pt-6 pb-4 px-6 flex items-center gap-3">
        <div className="relative">
          <div className="absolute inset-0 bg-calm blur-md opacity-40 animate-pulse" />
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-calm to-blue-600 flex items-center justify-center relative z-10 shadow-[0_0_15px_rgba(6,182,212,0.5)]">
            <Activity className="w-5 h-5 text-black" />
          </div>
        </div>
        <div>
          <h1 className="tracking-widest text-white font-black text-lg">REZON</h1>
          <p className="text-[9px] uppercase text-calm tracking-[0.2em] font-semibold">Command Center</p>
        </div>
      </div>

      <div className="px-3 pb-6 flex-1">
        {NAV_GROUPS.map((group, idx) => (
          <div key={group.label || "utility"} className={idx !== 0 ? "mt-6" : ""}>
            {group.label && (
              <div className="px-3 pb-2 text-[10px] font-bold uppercase tracking-widest text-text-3">
                {group.label}
              </div>
            )}
            <div className="space-y-1">
              {group.items
                .filter((item) => !item.operatorOnly || isOperator)
                .map((item) => {
                  const isActive = pathname === item.href;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-300 ${
                        isActive
                          ? "bg-gradient-to-r from-calm/20 to-transparent text-white border-l-2 border-calm shadow-[inset_20px_0_20px_-20px_rgba(6,182,212,0.3)]"
                          : "text-text-2 hover:text-white hover:bg-surface border-l-2 border-transparent"
                      }`}
                    >
                      <item.icon className={`w-4 h-4 transition-colors ${isActive ? 'text-calm' : 'text-text-3 group-hover:text-calm/70'}`} />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
            </div>
          </div>
        ))}
      </div>
      
      <div className="p-4 mt-auto border-t border-border/50 bg-surface-2/30 backdrop-blur-sm">
        <div className="flex items-center gap-3 bg-surface-3 p-3 rounded-xl border border-border/50">
          <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.8)] animate-pulse" />
          <div className="flex flex-col">
            <span className="text-xs text-white font-semibold">Systems Nominal</span>
            <span className="text-[10px] text-text-3">All 5 Agents Online</span>
          </div>
        </div>
      </div>
    </aside>
  );
}
