# SESSION 28 — Frontend Verification
**Risk tier: HIGH-RISK (closes the entire 19-page frontend build — same seriousness as `AUDIT_01` closing Phase 1's firmware sessions). Session TYPE: verification — no code, real checks against the real built app.**
**Branch: `session/audit-28-frontend-verification`**
**Attach: Sessions 10-27 (as actually built), `05_FRONTEND_TECHNICAL_SPEC.md`, `VERIFY_01-03*.md`**

---

## Why this session exists, restated (same reasoning as AUDIT_01)

18 sessions built the frontend. Individually verified sessions can still disagree with each other once integrated — the exact AEGIS lesson (`DEC-013`) applied to this phase specifically. This session re-checks the *whole* app, not each page in isolation.

## Checklist

### Routing & structure
- [ ] All 19 routes from `05_FRONTEND_TECHNICAL_SPEC.md` §3 actually exist and load without error.
- [ ] `/status` genuinely has no sidebar and no auth check — visit it in an incognito window with zero prior session, confirm no redirect to `/login`.
- [ ] Command palette (Session 12) can navigate to all 19 routes — spot-check at least 5, not just trust the static list.

### Data source integrity (the class of check that found DEC-041/046/049)
- [ ] Every page's actual data queries reference real, existing table/column names — grep the real codebase for every `.from("...")` call and cross-check each against the real, current Backend schema, not the schema as remembered from when each session was written.
- [ ] Confirm `env_score`, `drift_status`, the device-health fields, and `notification_preferences` are each genuinely populated by a real write path (device firmware or scheduled script), not just present in the schema with nothing ever filling them.

### Real-time tier correctness (Frontend Spec §6's table, re-checked against real implementation)
- [ ] Home, Sensor Streams, Safety Chain Monitor: confirm genuinely using Realtime subscriptions, not accidentally polling.
- [ ] Incidents, Analytics, Model & Drift, Device: confirm ~20s polling, not accidentally subscribed to Realtime (a real mistake that would waste connection budget for no benefit on pages that don't need sub-second updates).
- [ ] Since-Calibration, Digest, Trust Audit, Settings, Access: confirm fetch-once, no polling — open dev tools' network tab and watch for at least 60 real seconds on each, confirm zero repeated requests.

### Auth & role enforcement (re-verify server-side, not just UI)
- [ ] As a real `viewer` test user: attempt every operator-only write path directly from the browser console (incident labeling, OTA-adjacent actions, role changes, notification preference edits) — confirm each genuinely fails at the database level, not just that the button is hidden.
- [ ] Confirm `/access` middleware redirect still works after all 18 sessions' worth of changes — a later session could have accidentally weakened this.

### Edge-case standard (per DEC-052/053's explicit scoping)
- [ ] Home, Incidents, Safety Chain Monitor: confirm the real empty-state vs. error-state distinction from Session 27 genuinely renders correctly, not just that the code exists.
- [ ] Public Status: confirm all three real states from Session 26 (no-device-yet, query-failed, paused-likely) are reachable and visually distinct.

### Cross-page consistency
- [ ] Score-to-color mapping: spot-check the same score value (e.g., 0.8) across Home, Streams, Incidents, and the Safety Chain — confirm identical color rendering everywhere, proving `scoreToColorToken` (Session 10) is genuinely the single source of truth, not reimplemented inconsistently anywhere.
- [ ] Confirm no page independently reimplements the resilience-wrapper logic instead of importing Session 13's shared component.

### Accessibility & performance (real product-quality checks)
- [ ] Keyboard-only navigation: tab through the sidebar and command palette without a mouse, confirm every interactive element is reachable.
- [ ] With all 19 pages, confirm no single page takes visibly longer than ~2s to reach first meaningful content on a real (not synthetic-fast) network connection.

## Gate for this session
Not complete until every checked item has real evidence (an actual grep result, an actual network-tab observation, an actual failed console command) — matching `AUDIT_01`'s exact standard, not a lighter version of it because this is "just frontend."

## If this finds something
Same discipline as every prior finding in this project: Blocker Report for anything architecturally significant, logged honestly either way — a clean result here is exactly as valuable to record as a real one, per this project's own established practice.
