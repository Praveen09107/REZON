"use client";
import { useEffect, useState, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";

interface ProfileRow { user_id: string; role: string; email?: string }

export default function AccessPage() {
  const supabase = useMemo(() => createClient(), []);
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);

  useEffect(() => {
    // Reachable only by operators — middleware (Session 11) already
    // redirects a viewer away before this component ever mounts.
    supabase.from("profiles").select("*").then(({ data }) => setProfiles(data ?? []));
  }, [supabase]);

  async function changeRole(userId: string, newRole: string) {
    await supabase.from("profiles").update({ role: newRole }).eq("user_id", userId);
    setProfiles((prev) => prev.map((p) => (p.user_id === userId ? { ...p, role: newRole } : p)));
  }

  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      {profiles.map((p) => (
        <div key={p.user_id} className="flex items-center justify-between border-b border-border py-2.5 last:border-0">
          <span className="font-mono text-xs text-text-2">{p.user_id.slice(0, 8)}…</span>
          <select value={p.role} onChange={(e) => changeRole(p.user_id, e.target.value)}
            className="rounded border border-border bg-surface-2 px-2 py-1 text-xs text-text">
            <option value="operator">operator</option>
            <option value="viewer">viewer</option>
          </select>
        </div>
      ))}
    </div>
  );
}
