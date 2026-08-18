# Contributing to REZON
**Solo project — this file exists so the rules are written down, not just known. Full detail lives in `specs/methodology/GIT_CONVENTIONS.md` and `specs/methodology/METHODOLOGY.md`; this is the quick-reference version.**

## Before any session
- Read `specs/verification/STATUS.md` first — never assume state from memory.
- Branch: `session/build-NN-name` or `session/retrofit-NN-name`, off `main`.

## During a session
- Read the full session spec before writing anything (three-pass discipline, `CLAUDE.md`).
- Build exactly what's specified — nothing invented, nothing extra. Something genuinely useful but out of scope gets named as a new open item, not built silently.
- Hardware-touching work requires a real `HW_VERIFICATION_LOG.md` entry — code that compiles is not evidence.
- Safety-critical work (ADD §9/§11/§12.2) requires explicit sign-off before being treated as settled — see `METHODOLOGY.md` §3.

## Before committing
- Every verification step in the session spec must genuinely pass — one failing check is an incomplete session, not "mostly done."
- Update `specs/verification/STATUS.md` and, if a real decision or finding occurred, `specs/verification/DECISIONS_LOG.md` — append-only, numbered, never edit old entries except to mark them superseded.
- Commit messages carry real content (what was built/fixed, specifically) — not just a session number.

## Never
- Push to a shared remote without being explicitly asked.
- Leave placeholder code (`TODO`, bare `pass`, stub returns) in a session marked complete.
- Silently adapt when a spec's assumption doesn't match reality — stop and produce a Blocker Report (`specs/verification/BLOCKER_REPORT_TEMPLATE.md`).
