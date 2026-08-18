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
