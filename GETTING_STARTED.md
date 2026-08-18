# REZON — Getting Started
**This file is for YOU, not Claude Code. Nothing else in this package explains the actual mechanics of standing this up — this does.**

---

## 1. Prerequisites

- **Git** installed on your machine.
- **A GitHub account** (or any git host — GitHub assumed below).
- **Claude Code** installed. If you haven't already: follow Anthropic's current installation instructions for your OS (this changes over time — check `docs.claude.com` directly rather than trust an old guide, same "verify, don't recall" discipline as everywhere else in this project).
- The hardware components, physically with you (per your earlier confirmation).

---

## 2. Create the actual repo

```bash
# 1. Create a new empty repository on GitHub first (via the website), named e.g. "rezon".
#    Do NOT initialize it with a README/gitignore on GitHub's side — you'll push
#    this package's content as the first commit instead.

# 2. On your machine:
mkdir rezon && cd rezon
git init
git branch -M main

# 3. Unzip this package's contents directly into this folder, so you get:
#    rezon/.claude/CLAUDE.md
#    rezon/specs/...
#    rezon/GETTING_STARTED.md
#    (unzip rezon-methodology.zip, then move the CONTENTS of the
#    rezon-methodology/ folder up into your rezon/ repo root — you don't
#    want an extra nested folder level)

# 4. First commit
git add -A
git commit -m "Initial commit: REZON methodology and technical specs (Phases A-C complete)"

# 5. Connect to GitHub and push
git remote add origin https://github.com/<your-username>/rezon.git
git push -u origin main
```

---

## 3. Install the four slash commands, and seed Claude Code's own memory (Session 0)

`specs/methodology/SLASH_COMMANDS.md` describes what each command should DO — it does not create them as real files. Do that now, as a genuine first Claude Code session (low-risk, confirms the whole toolchain actually works before Session 1 carries real stakes):

```bash
mkdir -p .claude/commands
```

In your first Claude Code session:
```
Read specs/methodology/SLASH_COMMANDS.md in full, then create the four
command files it describes in .claude/commands/. Then read
specs/methodology/METHODOLOGY.md section 9 and seed the user-profile
memory it specifies.
```

This is Session 0 — confirming git/Claude Code mechanics work and seeding continuity memory, before Session 1's real informational stakes (the current-facts check).

---

## 4. What running a session actually looks like, mechanically

```bash
cd rezon                          # always work from the repo root
git checkout main
git status                        # confirm clean
git checkout -b session/build-01-env-and-pinmap    # per GIT_CONVENTIONS.md

claude                            # starts Claude Code in this directory —
                                   # it automatically reads .claude/CLAUDE.md
```

Inside the Claude Code session, your first message should point it at the specific session spec:

```
Read specs/sessions/SESSION_01_environment_and_pin_mapping.md in full, then
follow the three-pass spec-reading discipline from CLAUDE.md's
"Spec-reading discipline" section before doing anything else. Run
/rezon-session-start once you've done that.
```

From there, Claude Code works through the session's tasks, and you verify per `/rezon-verify`'s behavior for that session's risk tier (routine vs. hardware vs. safety-critical, per `METHODOLOGY.md` §6). When it's genuinely done — not "looks done" — commit and merge per `GIT_CONVENTIONS.md`.

---

## 5. Before you run Session 1 at all

**Give your sign-off on the two flagged safety-critical documents first** (`specs/technical/01_AI_ML_TECHNICAL_SPEC.md` §6.4, `specs/technical/02_FIRMWARE_RTOS_TECHNICAL_SPEC.md` §5). Once confirmed, log that confirmation as a new Decisions Log entry (`DEC-010`, or ask a fresh Claude Code session to draft it for your review) — this is what actually unblocks Phase 1 per the methodology's own rule, not an informal "yeah looks good."

---

## 6. When you need the next session's spec

Come back to this conversation (or start a new one, pointing it at this repo/package for context) and ask for `SESSION_02` — hardware assembly and wiring — written in full, the same way `SESSION_01` was. Repeat per session, just-in-time, as the roadmap table lays out.
