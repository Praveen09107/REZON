import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

serve(async (req) => {
  if (req.method !== "GET") {
    return new Response("Method not allowed", { status: 405 });
  }

  const url = new URL(req.url);
  const deviceId = url.searchParams.get("device_id");
  const currentVersion = url.searchParams.get("current_version");

  if (!deviceId || !currentVersion) {
    return new Response(JSON.stringify({ error: "Missing device_id or current_version" }), { status: 400 });
  }

  try {
    // Check if there is a staged model that is newer
    const { data: models, error: modelError } = await supabase
      .from("model_registry")
      .select("version, checksum_sha256, storage_path, status, created_at")
      .eq("status", "staged")
      .order("created_at", { ascending: false })
      .limit(1);

    if (modelError || !models || models.length === 0) {
      return new Response(null, { status: 204 });
    }

    const latestModel = models[0];

    // Basic string comparison assuming semantic versioning for now, 
    // real implementation would parse the version properly
    if (latestModel.version === currentVersion) {
      return new Response(null, { status: 204 });
    }

    // Generate signed URL
    const { data: signedData, error: signError } = await supabase.storage
      .from("models")
      .createSignedUrl(latestModel.storage_path, 3600); // 1 hour expiry

    if (signError || !signedData) {
      console.error("Signed URL error:", signError);
      return new Response(JSON.stringify({ error: "Failed to generate download URL" }), { status: 500 });
    }

    return new Response(JSON.stringify({
      version: latestModel.version,
      checksum_sha256: latestModel.checksum_sha256,
      download_url: signedData.signedUrl
    }), { status: 200, headers: { "Content-Type": "application/json" } });

  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: "Internal Server Error" }), { status: 500 });
  }
});
