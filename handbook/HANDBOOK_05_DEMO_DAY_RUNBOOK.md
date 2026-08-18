# Handbook 05 — Demo Day Runbook
**The actual checklist for the day of your live demo + viva. Written now, while the reasoning is fresh, not assembled the night before.**

## Days before
- [ ] Run `VERIFY_04`'s full health check on the actual demo network (institutional Wi-Fi, if that's where you'll present) — per the ADD's own named risk, campus networks commonly block non-standard ports. Test this early enough to have a fallback ready, not discover it live.
- [ ] Full rehearsal of the induced-anomaly test protocol (physically trigger a real event, confirm the full chain — detection, alert, safety gates, actuation — behaves as designed and is visible on the frontend).
- [ ] Confirm the Supabase project isn't paused (7-day inactivity, Backend Spec §3) — if the device has been off, resume it manually before the demo, not during it.

## The day of
- [ ] Device powered on, confirmed reporting (`VERIFY_04` device row) at least 30 minutes before presenting — not powered on as you walk in.
- [ ] Frontend open and confirmed showing live (moving) data, not a frozen/stale state.
- [ ] Hotspot fallback ready and tested, in case the venue network blocks the connection.
- [ ] A pre-recorded backup video of the live dashboard updating, in case live networking fails entirely — the honest last resort, prepared in advance, not improvised.

## During the demo — the story to tell, tied to what actually makes REZON defensible
1. Show the digital twin — the space, the sensors, live.
2. Trigger a real, physical anomaly (per your rehearsed protocol) — show the alert firing, then the safety chain visualization actually stepping through its real gates (not just claiming they exist).
3. Show the Trust Audit page — this is where the engineering rigor becomes visible and browsable, not just something you assert.
4. If asked "what if the model is wrong" — show the physical override switch, explain it's independent of firmware by design.

## If something breaks live
Don't try to debug in front of judges. Fall back to the recorded video, explain honestly what the live system does when it's working (which you've already demonstrated in rehearsal) — a calm, honest fallback is more credible than a flustered live debug attempt.
