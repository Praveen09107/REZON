# REZON — Slash Command Specifications
**Build these as `.claude/commands/*.md` in the actual repo. Four commands, same four jobs AEGIS used — automate the rituals that are easy to skip under time pressure.**

## `/rezon-session-start [N]`
Run at the start of every session, before any other work. Confirms: correct working directory, correct git branch (matches the session's intended branch name), environment sanity (required tooling installed — ESP-IDF for firmware sessions, Supabase CLI for cloud sessions, Docker running for local-stack sessions, Node for frontend sessions), and reports back before proceeding. **Also reads `STATUS.md` and reports the current phase and any OPEN items relevant to this session's scope.**

## `/rezon-retrofit-check [file]`
Run before modifying an *existing* file. Reads the real, current state of that file and diagnoses it against what the spec/amendment assumes about it. Reports mismatches — **does not fix them.** This is what catches "the spec assumed this function takes these arguments, but the real code takes different ones" before an edit happens, not after.

## `/rezon-verify [session-type]`
The session's verification gate. Behavior depends on session type:
- **Routine sessions:** runs the real automated checks (build, lint, relevant test suite) and only produces a "session complete" summary if everything genuinely passed.
- **HIGH-RISK / hardware sessions:** runs any automated checks that apply, **then explicitly prompts for the physical verification step** (per `METHODOLOGY.md` §4) and requires that a `HW_VERIFICATION_LOG.md` entry actually exists for this session before it can report complete. A hardware session cannot self-certify as done from automated checks alone.
- **Safety-critical sessions (ADD §9/§11/§12.2):** additionally checks whether the session's Decisions Log entry shows explicit developer sign-off, not just Claude Code's own reasoning, before reporting complete.

## `/rezon-report-blocker`
Invoked when a real discrepancy is found that shouldn't be resolved unilaterally. Produces the structured report from `BLOCKER_REPORT_TEMPLATE.md`, explicitly flags whether it touches a safety-critical section, and stops for a decision rather than proceeding on inference alone.

---

**Note on hardware sessions specifically:** unlike AEGIS, where `/project-verify` could be fully autonomous, `/rezon-verify` on a hardware-tagged session is deliberately *not* fully autonomous — it's designed to force a stop-and-check-with-the-human moment, because that's the only way a physical claim gets genuinely verified rather than inferred from code.
