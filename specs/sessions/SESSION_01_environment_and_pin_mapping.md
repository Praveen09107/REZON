# SESSION 01 — Environment Setup, Current-Facts Check, Pin Mapping
**Risk tier: Routine (no hardware touched yet, no safety-critical logic yet)**
**Branch: `session/build-01-env-and-pinmap`**

---

## 1. Session-start checklist
- Confirm repo initialized, on the correct branch.
- Confirm the methodology layer (`.claude/CLAUDE.md`, `specs/methodology/*`, `specs/verification/*`, `specs/BUILD_ROADMAP.md`) is present and matches what's described in `STATUS.md`.

## 2. Task A — Current-facts verification pass (do this before task B or C)
Per `METHODOLOGY.md` §7: re-check, live, anything time-sensitive the ADD or earlier design conversation assumed. Specifically:
- Current Supabase free-tier limits (DB size, Edge Function invocations, Storage, Auth MAU, the 7-day-inactivity pause behavior) — confirm still accurate.
- Current ESP-IDF version and toolchain setup steps for the ESP32-S3-WROOM-1 N16R8 board specifically.
- Current Next.js + shadcn/ui setup steps and any breaking changes since the ADD was written.
- Current TensorFlow Lite Micro / quantization tooling versions compatible with ESP32-S3.
- Any board/component availability changes for anything not yet purchased.

**Log findings as Decisions Log entries** (even "confirmed unchanged" is worth a short entry — it's evidence the check happened, not just an assumption that it would have been fine). If anything materially changed from the ADD's assumption, that's a new OPEN item or a proposed amendment, not a silent adjustment.

## 3. Task B — Repo scaffolding
Create the full directory structure per `METHODOLOGY.md` §2. Initialize git. Set up the actual `.claude/commands/` files from `specs/methodology/SLASH_COMMANDS.md`. Confirm `/rezon-session-start`, `/rezon-verify`, `/rezon-retrofit-check`, `/rezon-report-blocker` all run without error (even if trivial at this stage — nothing to verify yet, but the commands themselves should work).

## 4. Task C — GPIO pin-mapping table
Produce the concrete pin-mapping the ADD (§7.6) calls for but doesn't specify: every sensor (I2S for INMP441, I2C bus for MPU-6050+BMP280, single-wire for DHT22, ADC×2 for MQ135 and ACS712, SPI for microSD if used, GPIO for SW-420/relay/LED/buzzer/override-switch) mapped to actual ESP32-S3-WROOM-1 N16R8 pin numbers, checked against the real board's actual broken-out pins (not assumed from a generic ESP32-S3 pinout). Save as `specs/sessions/PIN_MAPPING.md`, referenced by every future firmware session.

## 5. Verification (this session's gate)
- [ ] Current-facts findings logged in `DECISIONS_LOG.md`, any material changes flagged as OPEN items.
- [ ] Full repo structure exists and matches `METHODOLOGY.md` §2.
- [ ] All four slash commands run without error.
- [ ] `PIN_MAPPING.md` exists, covers every sensor/actuator, and is checked against the real board's documented pinout (cite the source).
- [ ] `STATUS.md` updated: Phase 0 complete, Phase 1 next, pointer to Session 02.

**This session does not touch hardware and is not safety-critical — Routine tier ceremony applies. No `HW_VERIFICATION_LOG.md` entry required yet.**
