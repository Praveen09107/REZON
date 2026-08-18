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
