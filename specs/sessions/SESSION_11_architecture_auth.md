# SESSION 11 — Architecture, Routing & Auth
**Risk tier: ROUTINE (standard Supabase Auth pattern, no safety-critical logic — but real security-relevant code, treated carefully regardless of risk tier).**
**Branch: `session/build-11-architecture-auth`**
**Attach: `05_FRONTEND_TECHNICAL_SPEC.md` §3-5, `03_BACKEND_CLOUD_TECHNICAL_SPEC.md` §2**

---

## Agent Instructions

Build the app shell: Supabase client setup, auth context (session + role), middleware-based route protection, and the API client wrapper every later page uses. No actual page content yet — Session 12+ builds real pages on top of this.

**What this session creates:**
- `frontend/lib/supabase/client.ts` / `server.ts` — Supabase client instances (browser vs. server component contexts differ in Next.js App Router)
- `frontend/lib/auth-context.tsx` — React context providing session + role
- `frontend/middleware.ts` — route guards
- `frontend/app/login/page.tsx` — minimal real sign-in page
- `frontend/lib/api-client.ts` — typed wrapper around Supabase queries

---

## FILE 1: `frontend/lib/supabase/client.ts`

```typescript
import { createBrowserClient } from "@supabase/ssr";

// 🟡 Environment variables per HANDBOOK_04_FRONTEND_DEPLOY.md §2 —
// anon key only, never the service-role key in frontend-exposed vars
// (Backend Spec §2's write-bypasses-RLS design means the service role
// must never leave the Edge Function environment).
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
```

## FILE 2: `frontend/lib/supabase/server.ts`

```typescript
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// Server Component / Route Handler variant — needed because Next.js
// App Router splits client-side and server-side Supabase clients;
// using the wrong one in the wrong context is a common real mistake
// this explicit split is meant to prevent, not a REZON-specific quirk.
export async function createServerSupabaseClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options));
        },
      },
    }
  );
}
```

## FILE 3: `frontend/lib/auth-context.tsx`

```typescript
"use client";
import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { createClient } from "./supabase/client";
import type { User } from "@supabase/supabase-js";

type Role = "operator" | "viewer" | null;

interface AuthState {
  user: User | null;
  role: Role;
  loading: boolean;
}

const AuthContext = createContext<AuthState>({ user: null, role: null, loading: true });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ user: null, role: null, loading: true });
  const supabase = createClient();

  useEffect(() => {
    async function loadSession() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        setState({ user: null, role: null, loading: false });
        return;
      }
      // Role fetched from profiles table (Backend Spec §1) — this is
      // a READ, governed by RLS (§2), not a client-trusted claim.
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("user_id", session.user.id)
        .single();

      setState({ user: session.user, role: (profile?.role as Role) ?? "viewer", loading: false });
    }
    loadSession();

    const { data: listener } = supabase.auth.onAuthStateChange(() => loadSession());
    return () => listener.subscription.unsubscribe();
  }, []);

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>;
}

export function useAuth() { return useContext(AuthContext); }

// Client-side convenience check — per Frontend Spec §4's explicit
// clarification, this is UX polish (hide/disable a button), NOT
// security. The real enforcement is server-side RLS, always.
export function useIsOperator() {
  const { role } = useAuth();
  return role === "operator";
}
```

## FILE 4: `frontend/middleware.ts`

```typescript
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_ROUTES = ["/status", "/login"];

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll(); },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options));
        },
      },
    }
  );

  const { data: { session } } = await supabase.auth.getSession();
  const path = request.nextUrl.pathname;

  // Frontend Spec §5: /status is genuinely public, no auth check at all.
  if (PUBLIC_ROUTES.some((route) => path.startsWith(route))) {
    return response;
  }

  if (!session) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // /access requires operator role — checked here for immediate UX
  // redirect, real enforcement is still Backend Spec §2's RLS on the
  // underlying data operations this page would trigger.
  if (path.startsWith("/access")) {
    const { data: profile } = await supabase
      .from("profiles").select("role").eq("user_id", session.user.id).single();
    if (profile?.role !== "operator") {
      return NextResponse.redirect(new URL("/", request.url));
    }
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
```

## FILE 5: `frontend/app/login/page.tsx`

```typescript
"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createClient();

  async function handleMagicLink(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const { error } = await supabase.auth.signInWithOtp({ email });
    if (error) setError(error.message);
    else alert("Check your email for the sign-in link.");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg">
      <form onSubmit={handleMagicLink} className="w-80 space-y-4 rounded-lg border border-border bg-surface p-6">
        <h1 className="text-lg font-semibold text-text">REZON</h1>
        <input
          type="email" value={email} onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com" required
          className="w-full rounded border border-border bg-surface-2 px-3 py-2 text-text"
        />
        {error && <p className="text-sm text-danger">{error}</p>}
        <button type="submit" className="w-full rounded bg-calm px-3 py-2 text-bg font-medium">
          Send sign-in link
        </button>
      </form>
    </div>
  );
}
```

## FILE 6: `frontend/lib/api-client.ts`

```typescript
import { createClient } from "./supabase/client";

// Typed wrapper — real field names matching Backend Spec §1's schema
// exactly, checked against the live document while writing this file,
// not assumed. Session 12+'s data hooks build on these, not raw
// Supabase calls scattered per-component.

export interface TelemetryRow {
  id: string;
  device_id: string;
  recorded_at: string;
  audio_score: number;
  vibration_score: number;
  env_score: number;
  gas_score: number;
  current_score: number;
  fused_score: number;
  env_temp: number;
  env_humidity: number;
  env_pressure: number;
}

export async function getLatestTelemetry(): Promise<TelemetryRow | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("telemetry")
    .select("*")
    .order("recorded_at", { ascending: false })
    .limit(1)
    .single();
  if (error) {
    console.error("getLatestTelemetry failed:", error.message);
    return null;
  }
  return data;
}

export function subscribeToTelemetry(onInsert: (row: TelemetryRow) => void) {
  const supabase = createClient();
  return supabase
    .channel("telemetry-live")
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "telemetry" },
        (payload) => onInsert(payload.new as TelemetryRow))
    .subscribe();
}
```

---

## Verification Steps

**Step 1:** `npm run build` — expected: succeeds, zero type errors (the `TelemetryRow` interface should catch any real schema mismatch at compile time, not runtime).

**Step 2 (real integration test, per `VERIFY_02`'s "hit the real thing" philosophy):** with a real Supabase project and a real test user provisioned, complete the actual magic-link sign-in flow, confirm redirect to `/` succeeds, confirm `useAuth()`'s `role` value matches what's really in the `profiles` table for that user — not assumed from the code.

**Step 3:** Attempt to visit `/access` as a `viewer`-role test user — confirm the middleware redirect actually fires. Attempt the same as an `operator` — confirm it doesn't.

**Step 4:** Visit `/status` with no session at all — confirm it loads without redirecting to `/login` (the one deliberately public route).

## Known open items
None — this session is self-contained, building only on Session 10's design system.
