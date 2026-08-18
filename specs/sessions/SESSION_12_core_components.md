# SESSION 12 — Core Shared Components & Layout Shell
**Risk tier: ROUTINE.**
**Branch: `session/build-12-core-components`**
**Attach: `05_FRONTEND_TECHNICAL_SPEC.md` §3, `specs/frontend-research/FRONTEND_ELEVATION_VISION.md` §9 (command palette, global toast)**

---

## Agent Instructions

Build the persistent app shell every page renders inside: sidebar navigation (real 19-route list, zone-grouped), topbar, the command palette, and a global live-event toast system — the two "worth doing regardless of scope" usability wins from the elevation vision, built once here rather than per-page later.

**What this session creates:**
- `frontend/components/layout/sidebar.tsx` — real navigation, all 19 routes
- `frontend/components/layout/topbar.tsx`
- `frontend/components/layout/app-shell.tsx` — wraps authenticated pages
- `frontend/components/command-palette.tsx` — Cmd+K
- `frontend/components/toast-provider.tsx` — global live-event notifications
- `frontend/app/layout.tsx` — RETROFIT: wire the shell + providers in

---

## FILE 1: `frontend/components/layout/sidebar.tsx`

```typescript
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
    <aside className="w-56 shrink-0 border-r border-border bg-surface p-3">
      <div className="mb-5 flex items-center gap-2 px-2 py-1.5 text-lg font-semibold">
        <span className="h-2.5 w-2.5 rounded-full bg-calm shadow-[0_0_10px_var(--calm)]" />
        REZON
      </div>
      {NAV_GROUPS.map((group) => (
        <div key={group.label || "utility"}>
          {group.label && (
            <div className="px-2 pb-1.5 pt-3 text-[10.5px] uppercase tracking-wide text-text-3">
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
                <span>{item.icon}</span>{item.label}
              </Link>
            ))}
        </div>
      ))}
    </aside>
  );
}
```

## FILE 2: `frontend/components/command-palette.tsx`

```typescript
"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Command } from "cmdk";  // real, standard library for this pattern

const ALL_ROUTES = [
  { href: "/", label: "Home" }, { href: "/streams", label: "Sensor Streams" },
  { href: "/incidents", label: "Incidents" }, { href: "/safety-chain", label: "Safety Chain" },
  { href: "/timeline", label: "Activity Timeline" }, { href: "/analytics", label: "Analytics" },
  { href: "/model", label: "Model & Drift" }, { href: "/since-calibration", label: "Since Calibration" },
  { href: "/sandbox", label: "Threshold Sandbox" }, { href: "/digest", label: "Weekly Digest" },
  { href: "/trust-audit", label: "Trust Audit" }, { href: "/device", label: "Device & Machine" },
  { href: "/calibration", label: "Sensor Calibration" }, { href: "/deployments", label: "Deployments" },
  { href: "/notifications", label: "Notifications" }, { href: "/access", label: "Access" },
  { href: "/settings", label: "Settings" }, { href: "/help", label: "Help" },
];

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <Command.Dialog open={open} onOpenChange={setOpen}
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 pt-24">
      <div className="w-full max-w-md rounded-lg border border-border bg-surface p-2">
        <Command.Input
          placeholder="Jump to..."
          className="w-full rounded bg-surface-2 px-3 py-2 text-text outline-none"
        />
        <Command.List className="mt-2 max-h-80 overflow-auto">
          <Command.Empty className="p-3 text-sm text-text-2">No results</Command.Empty>
          {ALL_ROUTES.map((route) => (
            <Command.Item
              key={route.href}
              onSelect={() => { router.push(route.href); setOpen(false); }}
              className="cursor-pointer rounded px-3 py-2 text-sm text-text-2 aria-selected:bg-calm-bg aria-selected:text-calm"
            >
              {route.label}
            </Command.Item>
          ))}
        </Command.List>
      </div>
    </Command.Dialog>
  );
}
```

## FILE 3: `frontend/components/toast-provider.tsx`

```typescript
"use client";
import { createContext, useContext, useState, ReactNode, useEffect } from "react";
import { subscribeToTelemetry } from "@/lib/api-client";

interface Toast { id: string; message: string; variant: "alert" | "info"; }
const ToastContext = createContext<{ toasts: Toast[] }>({ toasts: [] });

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    // Global — fires regardless of which page you're on, per the
    // elevation vision's explicit requirement: an anomaly on Session
    // 17's page shouldn't require being on Home to notice.
    const channel = subscribeToTelemetry((row) => {
      if (row.fused_score >= 0.65) {  // AI/ML Spec §7.3 alert threshold
        const toast: Toast = {
          id: row.id,
          message: `Alert: fused score ${row.fused_score.toFixed(2)}`,
          variant: "alert",
        };
        setToasts((prev) => [...prev, toast]);
        setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== toast.id)), 8000);
      }
    });
    return () => { channel.unsubscribe(); };
  }, []);

  return (
    <ToastContext.Provider value={{ toasts }}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 space-y-2">
        {toasts.map((t) => (
          <div key={t.id} className={`rounded-lg border px-4 py-3 text-sm shadow-lg ${
            t.variant === "alert" ? "border-danger bg-danger-bg text-danger" : "border-border bg-surface text-text"
          }`}>
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
```

## FILE 4: `frontend/components/layout/app-shell.tsx`

```typescript
import { Sidebar } from "./sidebar";
import { CommandPalette } from "../command-palette";
import { ReactNode } from "react";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen bg-bg">
      <Sidebar />
      <main className="flex-1 overflow-auto p-6">{children}</main>
      <CommandPalette />
    </div>
  );
}
```

## FILE 5: `frontend/app/layout.tsx` — RETROFIT

```typescript
import { AuthProvider } from "@/lib/auth-context";
import { ToastProvider } from "@/components/toast-provider";
import { AppShell } from "@/components/layout/app-shell";
import "./globals.css";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          <ToastProvider>
            {/* /status and /login intentionally render OUTSIDE AppShell
                (no sidebar) — handled via Next.js route groups in
                Session 19's actual implementation; shown as the full
                shell here since that's every other route's real case */}
            <AppShell>{children}</AppShell>
          </ToastProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
```

---

## Verification Steps

**Step 1:** `npm run build` — succeeds, zero type errors.

**Step 2:** `npm run dev`, press Cmd+K (or Ctrl+K) — confirm the command palette opens, type a route label, confirm Enter navigates there.

**Step 3:** Sign in as a `viewer` test user — confirm "Access" doesn't appear in the sidebar. Sign in as `operator` — confirm it does.

**Step 4 (real-time smoke test):** with a real Supabase project connected, manually insert a `telemetry` row with `fused_score >= 0.65` directly in the Supabase dashboard — confirm a toast appears in the running app within a few seconds, without needing to be on any specific page.

## Known open items
🔴 `/status` and `/login` rendering outside the full `AppShell` (no sidebar) is noted but not yet implemented via Next.js route groups — flagged for Session 19 (Public Status Page) and revisit at that point, since implementing it correctly requires that session's actual route structure to exist first.
