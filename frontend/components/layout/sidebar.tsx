"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useIsOperator } from "@/lib/auth-context";

// Exact route list from Frontend Spec §3 — re-verified against the
// live document before writing, zone grouping matches the elevation
// vision's sitemap exactly.
const NAV_GROUPS = [
  { label: "Monitor", items: [
    { href: "/", label: "Home", icon: "◉" },
    { href: "/streams", label: "Sensor streams", icon: "∿" },
    { href: "/incidents", label: "Incidents", icon: "⚠" },
    { href: "/safety-chain", label: "Safety chain", icon: "⛓" },
    { href: "/timeline", label: "Activity timeline", icon: "◷" },
  ]},
  { label: "Analyze", items: [
    { href: "/analytics", label: "Analytics", icon: "◔" },
    { href: "/model", label: "Model & drift", icon: "◈" },
    { href: "/since-calibration", label: "Since calibration", icon: "⇄" },
    { href: "/sandbox", label: "Threshold sandbox", icon: "▤" },
    { href: "/digest", label: "Weekly digest", icon: "▥" },
    { href: "/trust-audit", label: "Trust audit", icon: "✓" },
  ]},
  { label: "Manage", items: [
    { href: "/device", label: "Device & machine", icon: "▦" },
    { href: "/calibration", label: "Sensor calibration", icon: "⚙" },
    { href: "/deployments", label: "Deployments", icon: "↑" },
    { href: "/notifications", label: "Notifications", icon: "🔔" },
    { href: "/access", label: "Access", icon: "◐", operatorOnly: true },
  ]},
  { label: "", items: [
    { href: "/settings", label: "Settings", icon: "⚙" },
    { href: "/help", label: "Help", icon: "?" },
  ]},
];

export function Sidebar() {
  const pathname = usePathname();
  const isOperator = useIsOperator();

  return (
    <aside className="w-14 md:w-56 shrink-0 border-r border-border bg-surface p-3 overflow-hidden">
      <div className="mb-5 flex items-center gap-2 px-2 py-1.5 text-lg font-semibold">
        <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-calm shadow-[0_0_10px_var(--calm)]" />
        <span className="hidden md:inline">REZON</span>
      </div>
      {NAV_GROUPS.map((group) => (
        <div key={group.label || "utility"}>
          {group.label && (
            <div className="hidden md:block px-2 pb-1.5 pt-3 text-[10.5px] uppercase tracking-wide text-text-3">
              {group.label}
            </div>
          )}
          {group.items
            .filter((item) => !item.operatorOnly || isOperator)  // UX-only filter —
                                                                     // real enforcement
                                                                     // is middleware (Session 11)
            .map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-2.5 rounded-md px-2.5 py-2 text-[13px] mb-0.5 ${
                  pathname === item.href
                    ? "bg-calm-bg text-calm"
                    : "text-text-2 hover:bg-surface-2 hover:text-text"
                }`}
              >
                <span className="shrink-0">{item.icon}</span>
                <span className="hidden md:inline">{item.label}</span>
              </Link>
            ))}
        </div>
      ))}
    </aside>
  );
}
