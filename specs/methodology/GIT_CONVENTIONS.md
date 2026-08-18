# REZON — Git Conventions

Solo project, no team — a `dev` branch layer is real overhead protecting `main` from a team that doesn't exist. Not used.

## Branch naming
- `session/build-NN-short-name` — fresh implementation work
- `session/retrofit-NN-short-name` — modifying already-built code
- The prefix itself tells a future reader (or future you) what kind of session it was without opening the branch.

## The session lifecycle
```bash
git checkout main
git status                              # confirm clean before branching
git checkout -b session/build-NN-name   # or session/retrofit-NN-name
```
Implement. Verify (real, per `SLASH_COMMANDS.md` → the verify command — must genuinely pass, not "mostly"). Then:
```bash
git add -A && git commit -m "[Session NN]: <specific, real content of what was built/fixed>"
git checkout main && git merge session/build-NN-name
```

**Commit messages carry real content.** `"Fix ACS712 noise: add moving-average + alpha filter before scoring, confirmed via multimeter against known load"` is worth far more, later, than `"Session 14 fixes"`.

## Push discipline
**Never push to a shared remote without being explicitly asked.** Local commits are cheap and reversible; a push is a bigger, harder-to-undo commitment. Default assumption: work stays local until you say otherwise.

## Before any destructive git operation
Check `git status` first; stash or commit anything uncommitted before `checkout`/`reset`/`clean` that could discard work. Cheap habit, prevents a genuinely bad class of mistake.

## Merge verification
Re-run the full verification gate on `main` after merging — a clean merge at the git level does not guarantee the combined behavior is still correct, especially for files like `DECISIONS_LOG.md` where two branches can each add non-conflicting-looking content that is semantically duplicated. If that happens, resolve it by actually reading both additions and reconciling them, not trusting an automatic merge.
