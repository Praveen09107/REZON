import { Sidebar } from "./sidebar";
import { CommandPalette } from "../command-palette";
import { ReactNode } from "react";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-screen bg-[#050505] overflow-hidden font-sans">
      <Sidebar />
      <main className="flex-1 overflow-y-auto p-6 md:p-10 relative">
        {/* Background ambient glow */}
        <div className="absolute top-0 left-0 right-0 h-96 bg-gradient-to-b from-calm/5 to-transparent pointer-events-none" />
        <div className="relative z-10 max-w-7xl mx-auto">
          {children}
        </div>
      </main>
      <CommandPalette />
    </div>
  );
}
