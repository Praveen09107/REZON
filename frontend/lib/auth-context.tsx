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
    // Temporary bypass for local development without Supabase backend running
    setState({ 
      user: { id: "temp-user", email: "operator@rezon.local" } as any, 
      role: "operator", 
      loading: false 
    });
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
