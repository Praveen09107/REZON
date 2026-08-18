"use client";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/auth-context";

export default function NotificationsPage() {
  const { user } = useAuth();
  const supabase = createClient();
  const [threshold, setThreshold] = useState(0.65);
  const [quietStart, setQuietStart] = useState<number | null>(null);
  const [quietEnd, setQuietEnd] = useState<number | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase.from("notification_preferences").select("*").eq("user_id", user.id).single()
      .then(({ data }) => {
        if (data) {
          setThreshold(data.alert_threshold);
          setQuietStart(data.quiet_hours_start);
          setQuietEnd(data.quiet_hours_end);
        }
      });
  }, [user, supabase]);

  async function save() {
    if (!user) return;
    await supabase.from("notification_preferences").upsert({
      user_id: user.id, alert_threshold: threshold,
      quiet_hours_start: quietStart, quiet_hours_end: quietEnd,
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="max-w-md space-y-4">
      {/* Honest scope banner — per DEC-049, this is not a code comment
          only a developer would see, it's the actual product being
          truthful with whoever uses it. */}
      <div className="rounded-md border border-elevated bg-elevated-bg px-3 py-2.5 text-xs text-elevated">
        These preferences are saved, but no email or push delivery is
        currently wired up — the in-app alert (visible while REZON is
        open) is the only working notification channel today.
      </div>

      <div className="rounded-xl border border-border bg-surface p-5">
        <label className="mb-1 block text-xs text-text-2">Alert threshold</label>
        <input type="range" min={0} max={1} step={0.01} value={threshold}
          onChange={(e) => setThreshold(parseFloat(e.target.value))} className="w-full accent-calm" />
        <div className="text-xs text-text-3">{threshold.toFixed(2)}</div>
      </div>

      <button onClick={save} className="rounded bg-calm px-4 py-2 text-sm font-medium text-bg">
        Save preferences
      </button>
      {saved && <span className="ml-3 text-xs text-calm">Saved</span>}
    </div>
  );
}
