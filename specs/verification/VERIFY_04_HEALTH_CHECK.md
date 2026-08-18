# VERIFY_04 — Health Check Requirements
**Operational "is the system alive right now" checks — different from VERIFY_01-02's build-time tests. These are the checks worth running before a demo, or any time something feels wrong, per `GETTING_STARTED.md`'s troubleshooting mindset.**

| Layer | Check | Real command/action, not a vague description |
|---|---|---|
| Device | Is it reporting? | `STATUS.md`-adjacent: query `devices.last_seen_at` in Supabase — should be within the last few seconds |
| Device | Is Wi-Fi actually connected? | Serial monitor output on boot — confirms, doesn't assume |
| Cloud | Is the Supabase project active? | Visit the dashboard — free tier pauses after 7 days idle (Backend Spec §3); a paused project shows clearly, not silently |
| Cloud | Is `/ingest` actually reachable? | `curl` it directly with a test payload — the real, most honest check, matching `VERIFY_02`'s "hit the real endpoint" philosophy |
| Local | Is the Docker stack up? | `docker compose ps` — every service should show healthy, not just "running" |
| Local | Is Tailscale connected? | Confirm the Tailscale admin console shows the machine online |
| Frontend | Is Vercel deployment live? | Visit the actual deployed URL, not just `localhost` |
| Frontend | Does live data actually flow? | Watch the Home page for ~30s, confirm the digital twin's pulse rate changes — a static, unmoving twin means something's actually wrong even if no error is thrown |

**Before any demo specifically:** run every row in this table in order, not just the ones that seem relevant — the network-reachability check (MQTT-port-blocking-equivalent, now an HTTPS-port check) is the one most likely to be silently broken by an institutional network you haven't tested on yet.
