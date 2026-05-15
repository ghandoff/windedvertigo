---
name: pre-cloud-delegation
description: Prepare a repo for a Claude Code cloud session (claude.ai/code). Use when the user says "I'm about to start a cloud session", "kicking off a cloud Claude task", "delegate this to claude.ai/code", "send this to cloud Claude", or asks to launch a web Claude Code session against a repo. Ensures the local working tree is pushed, main is current, and there are no open conflicting PRs — so the cloud VM clones a clean, current snapshot.
---

# Pre-cloud-delegation

When the user is about to start a Claude Code session at claude.ai/code, run this skill first. The cloud VM clones from GitHub, not the user's Mac — so anything not pushed is invisible to it.

## Goal

Zero surprises in the cloud session. The cloud VM should clone a current, clean snapshot of the branch the user wants to base its work on.

## Steps

1. **Confirm which repo and which base branch.** Ask if unclear. Default: `main` unless the user is iterating on a feature branch.

2. **Check working-tree cleanliness.**
   ```bash
   cd ~/Projects/<repo>
   git status --short
   ```
   If dirty: surface the modified files and ask whether to commit, stash, or discard. Do not silently push.

3. **Check that local main matches origin/main.**
   ```bash
   git fetch origin
   git log HEAD..origin/main --oneline   # what's on remote we don't have
   git log origin/main..HEAD --oneline   # what we have that's not on remote
   ```
   If user is on `main` and behind: `git pull --rebase`.
   If user has local commits on `main` not pushed: warn and push (or convert to a branch).

4. **Surface conflicting open PRs.** Run:
   ```bash
   gh pr list --state open --json number,title,headRefName,files --limit 20
   ```
   If any open PR touches files the cloud task is likely to touch, name them. Suggest the user either:
   - Merge those PRs first, or
   - Scope the cloud task to avoid those files, or
   - Acknowledge there will be a rebase conflict to resolve later.

5. **Confirm the cloud task scope** (briefly). Two-sentence summary: what the cloud session will do + what files it will likely touch. This gets pasted into the cloud session prompt later.

6. **Output the ready signal.** Final message: "Cloud session is safe to start. The cloud VM will clone `ghandoff/<repo>` at branch `<base>` commit `<sha>`. Recommended prompt opener: <2-sentence summary>."

## What not to do

- Do not start the cloud session for the user. This skill ends *before* the user opens claude.ai/code.
- Do not modify files. This skill is read-only against the working tree (except for the `git push` step, which only publishes existing commits).
- Do not delete or rebase branches.

## Reminder for the user

After the cloud session opens its PR, finish the loop:
- Review the PR on GitHub
- Squash-merge if good
- Click the "Delete branch" button on the PR page

This prevents the `claude/*` branch sprawl problem (currently 65 such branches across windedvertigo + harbour-apps).
