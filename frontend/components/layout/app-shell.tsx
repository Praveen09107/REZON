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
