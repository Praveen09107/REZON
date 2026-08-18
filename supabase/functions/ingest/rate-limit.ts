// Deno/Supabase Edge Function — the real DEC-060 implementation.
import { createClient } from "@supabase/supabase-js";

export async function checkRateLimit(
  supabase: ReturnType<typeof createClient>, deviceId: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from("devices")
    .select("last_seen_at")
    .eq("id", deviceId)
    .single();

  if (error || !data?.last_seen_at) return true;  // no prior request — allow

  const msSinceLast = Date.now() - new Date(data.last_seen_at).getTime();
  return msSinceLast >= 500;  // DEC-060's exact threshold
}

// Used in the real /ingest handler as:
//   if (!(await checkRateLimit(supabase, deviceId))) {
//     return new Response(JSON.stringify({ error: "rate limited" }),
//       { status: 429 });
//   }
