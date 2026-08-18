# Handbook 04 — Frontend Deployment (Vercel)
**Literal steps once the Next.js app exists (Phase 2 sessions) — this handbook covers deployment mechanics, not the app itself.**

## 1. Connect the repo to Vercel
Import the GitHub repo in Vercel's dashboard — it auto-detects Next.js, no custom build config needed for the standard case.

## 2. Environment variables
Set in Vercel's project settings (never committed to the repo): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (the anon key only — never the service-role key in frontend-exposed env vars).

## 3. Confirm the public/private split holds
After deploying: confirm the deployed app can read from Supabase (public data flows correctly) but has no path to Grafana/MLflow/the local database — those stay Tailscale-only regardless of what the frontend could theoretically reach, per `05_FRONTEND_TECHNICAL_SPEC.md` §4's auth boundary.

## 4. Custom domain (optional)
If you want a real domain for the public status page specifically — configure in Vercel's domain settings, standard DNS steps.

## 5. Preview deployments
Every git push to a non-`main` branch gets its own preview URL automatically — useful for reviewing a session's frontend work before merging, without waiting for a production deploy.

## 6. Confirm before moving on
Visit the live deployed URL (not `localhost`) and confirm live data actually flows — the same check as `VERIFY_04`'s frontend health check, but specifically against the real production deployment.
