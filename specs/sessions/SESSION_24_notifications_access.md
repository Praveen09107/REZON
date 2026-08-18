# SESSION 24 — Notifications + Access
**Risk tier: ROUTINE.**
**Branch: `session/build-24-notifications-access`**
**Attach: `05_FRONTEND_TECHNICAL_SPEC.md` §7, `03_BACKEND_CLOUD_TECHNICAL_SPEC.md` §1 (as retrofitted, `DEC-049`)**

---

## Agent Instructions

**Notifications page is honestly scoped per `DEC-049`**: it stores real preferences, and says plainly, in the UI itself, that no delivery mechanism exists yet — not just in a code comment. Access page is fully real: `profiles` table genuinely exists and is genuinely readable/writable per real RLS.

**What this session creates:**
- `frontend/app/notifications/page.tsx`
- `frontend/app/access/page.tsx`

---

## FILE 1: `frontend/app/notifications/page.tsx`

```typescript
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
  }, [user]);

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
```

## FILE 2: `frontend/app/access/page.tsx`

```typescript
"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

interface ProfileRow { user_id: string; role: string; email?: string }

export default function AccessPage() {
  const supabase = createClient();
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);

  useEffect(() => {
    // Reachable only by operators — middleware (Session 11) already
    // redirects a viewer away before this component ever mounts.
    supabase.from("profiles").select("*").then(({ data }) => setProfiles(data ?? []));
  }, []);

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
```

---

## Verification Steps

**Step 1:** `npm run build` — succeeds.

**Step 2:** Save real notification preferences, reload the page, confirm they persist (a real round trip, not just local state).

**Step 3 — the real security test, not just a UI check:** as a `viewer`-role user, attempt to directly call `supabase.from("profiles").update(...)` from the browser console — confirm it fails, because RLS (Backend Spec §2, operator-only write policy) genuinely enforces this server-side, not because the button happens to be hidden.

## Known open items
🔴 Notification delivery (email/push) — a real, standing architectural gap per `DEC-049`, not this session's scope to close. Named explicitly so it isn't mistaken for "already working."
