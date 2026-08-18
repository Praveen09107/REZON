# Handbook 02 — Cloud Setup (Supabase)
**Literal steps to stand up the cloud tier, per `03_BACKEND_CLOUD_TECHNICAL_SPEC.md`'s schema and contracts.**

## 1. Create the Supabase project
1. Go to supabase.com, create a new project.
2. Note the project URL and anon/service-role keys — you'll need both (anon for the frontend, service-role kept secret, used only by Edge Functions).
3. 🟡 **Verify current facts here, not from memory** (per `SESSION_GENERATION_PROTOCOL.md`'s discipline) — confirm the free-tier limits stated in `03_BACKEND_CLOUD_TECHNICAL_SPEC.md` still match Supabase's current terms before building on them.

## 2. Create the schema
Run the table definitions from Backend Spec §1 (`devices`, `telemetry`, `anomaly_events`, `model_registry`, `telemetry_summary`, `profiles`) via the Supabase SQL editor.

## 3. Set up RLS policies
Apply the policies from Backend Spec §2 — remember the key distinction: device writes go through the service role (bypassing RLS by design), RLS governs frontend reads only.

## 4. Deploy the Edge Functions
`/ingest`, `/models/latest`, `/ingest-summary` (Backend Spec §3) — via the Supabase CLI (`supabase functions deploy`).

## 5. Set up Storage
A bucket for model files (OTA source, Backend Spec §3.2) with appropriate access policy (signed URLs, not public).

## 6. Provision the device's credential
Generate the device's unique secret (Firmware Spec §7 / Backend Spec §2), store its hash in the `devices` table, store the raw secret in the device's own NVS (Session 3+).

## 7. Confirm reachability before moving on
`curl` the deployed `/ingest` endpoint with a test payload (per `VERIFY_02` test #1) — don't assume deployment succeeded from the CLI output alone.
