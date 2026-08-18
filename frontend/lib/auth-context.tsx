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
  }, [supabase]);

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
