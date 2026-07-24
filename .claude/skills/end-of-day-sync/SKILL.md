---
name: end-of-day-sync
description: Wrap up a working session — commit, push, and snapshot the day's work for Maria, Payton, and your future self. Use when the user says "end of day", "wrapping up", "logging off", "shutting down for the night", "end of session", or asks to summarize what they got done today. Pushes everything, records progress in TASKS.md / .brain/, and optionally writes a Slack-ready summary.
---

# End-of-day sync

Run when the user is winding down a working session. Less stringent than `pre-mobile-handoff` (which assumes they'll keep working from another device), but more thorough than a casual save.

## Goal

The user should be able to close their laptop and have:
1. All work either pushed, intentionally stashed, or noted as in-progress
2. A record of what they accomplished today (visible to Maria + Payton)
3. A short list of what's queued for tomorrow

## Steps

1. **Inventory today's work.** For each active repo, gather:
   ```bash
   # What branches did I touch today?
   git for-each-ref --sort=-committerdate refs/heads/ \
     --format='%(committerdate:short) %(refname:short)' | head -10

   # Today's commits across all branches
   git log --all --since=midnight --author="$(git config user.name)" --oneline
   ```

2. **Push everything pushable.**
   - Loop over local branches that have an upstream: `git push` each.
   - For branches without an upstream: ask the user if they want to publish or stash.

3. **Surface anything still open:**
   - Uncommitted changes in any repo
   - Open PRs that need user action (review, merge, address comments)
   - Cloud Claude Code sessions still running (the user can check at claude.ai/code if they want certainty)

4. **Update `TASKS.md` / `.brain/TASKS.md`.** Append (don't replace) a section:
   ```markdown
   ## Done — 2026-MM-DD

   - [x] <commit summary 1> (`<sha>`)
   - [x] <commit summary 2> (`<sha>`)

   ### In flight
   - [ ] <branch name> — <one-line status>

   ### Queue for tomorrow
   - [ ] <what the user said next>
   ```
   Use the user's voice: lowercase, terse. If the user already keeps tasks in a specific format (check the existing file), match it.

5. **Snapshot to vinay (garrett only).** If the `vinay_log_journal` tool is available in this session (vinay's MCP connector — garrett-only, may be absent), append the same 3-line snapshot to vinay's journal so it carries into the next session's `vinay_context`:
   - `did` = today's shipped work · `open` = what's in flight · `next` = the top item queued for tomorrow.

   Skip silently if the tool isn't present — vinay is garrett's personal assistant, not a shared step. Never route personal specifics to any other agent or channel.

6. **Optional: draft a Slack summary.** Ask: "Want me to draft a Slack message for #studio-comms summarizing today?" If yes, produce a short, friendly note in the voice convention from `CLAUDE.md` (lowercase, no jargon-as-drama, oxford comma).

7. **Report.** Final lines:
   - Repos pushed: list
   - PRs awaiting your action: count + links
   - TASKS.md updated: path
   - Slack draft: written or skipped

## What not to do

- Do not merge PRs as part of this skill. End-of-day is not the time to ship.
- Do not delete branches. That's `branch-cleanup`'s job.
- Do not write hype. Match the user's quiet, lowercase voice. No emoji unless the user opens with one.
- Do not assume what's "for tomorrow" — ask the user, briefly.

## Connection to the morning

The day after this runs, the first thing the user will probably do is open the TASKS.md and pick from "Queue for tomorrow". So write that section like the user is going to read it groggily, on their phone, before opening the laptop.
