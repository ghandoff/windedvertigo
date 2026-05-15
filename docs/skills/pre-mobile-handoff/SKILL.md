---
name: pre-mobile-handoff
description: Prepare to leave the desk — phone, travel, or mobile work. Use when the user says "going mobile", "leaving the desk", "travelling", "on my phone soon", "headed out", "switching to laptop", "logging off for the day but want to keep going from my phone", or anything that implies they need their in-progress work captured and pushed before switching devices. Confirms every repo is pushed, surfaces what was unfinished, and writes a handoff note so the mobile / cloud session can pick up where the desktop left off.
---

# Pre-mobile handoff

When Garrett (or anyone on the collective) is leaving the desk and may want to continue work from their phone, MacBook Pro, or the claude.ai/code web client, run this checklist.

## Goal

Make sure that when the user picks up another device — phone, laptop, web browser, or asks cloud Claude Code to keep going — nothing is stranded on the desktop Mac.

## Steps

1. **Identify every repo with pending work.** For each repo in `~/Projects/` that has a `.git` directory, run:
   ```bash
   cd ~/Projects/<repo>
   git status --short
   git log origin/$(git rev-parse --abbrev-ref HEAD)..HEAD --oneline 2>/dev/null
   ```
   The first command shows uncommitted changes; the second shows committed-but-unpushed work.

2. **For each repo with output, propose an action.**
   - If there are uncommitted changes that look like a coherent in-progress feature: offer to commit them with a `wip:` prefix and push.
   - If there are uncommitted changes that look like experimental / lockfile noise: offer to `git stash` them (named, e.g., `git stash push -m "pre-travel-stash-2026-05-14"`).
   - If there are committed-but-unpushed commits: push them.
   - Never silently discard work.

3. **Sync Maria's view.** Confirm with the user whether to also `git fetch origin` and surface any incoming branches or PRs from Maria/Payton that need attention before travel.

4. **Write a handoff note** to `.brain/handoff.md` (windedvertigo) or `.brain/handoff.md` in whichever repo is active. The note should contain:
   - Date + time + reason for handoff ("travel to {destination}", "going to phone for whirlpool", etc.)
   - Active branch in each repo and what's in flight
   - Any open cloud Claude Code sessions that are still running (the user can check at claude.ai/code)
   - Anything Maria or Payton should NOT touch while you're away (e.g., "do not merge migration PRs")
   - The exact command to resume on the other machine: `git pull --rebase` per repo

5. **Tell the user how to resume.** Three options to offer:
   - **MacBook Pro on travel:** `cd ~/Projects/<repo> && git pull --rebase && git checkout <branch>`
   - **Phone (claude.ai mobile app):** sessions started at claude.ai/code keep running and are visible from the mobile app. Tell them which sessions are currently running.
   - **Phone via Remote Control:** if the user has Remote Control enabled, the desktop session itself can be resumed from the phone.

## What not to do

- Do not push to `main` directly. If a commit is on `main` locally, push to a branch first and open a PR.
- Do not delete or rebase branches that Maria or Payton might have based work on.
- Do not merge any PRs as part of this skill — the user is about to be away from the keyboard and shouldn't be approving merges in a rush.

## Output format

Report at the end with:
- Repos checked: list
- Pushed: list of repos + branches
- Stashed: list (with stash names)
- Handoff note saved: path
- Open cloud sessions: list (URL or session name if known)
- Resume command for the destination device: one line

Keep this terse. The user is leaving — they want assurance, not prose.
