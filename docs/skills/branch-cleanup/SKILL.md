---
name: branch-cleanup
description: Audit and clean up stale git branches and orphaned worktrees in one or more repos. Use when the user says "clean up branches", "branch hygiene", "too many branches", "prune branches", "delete merged branches", "clean up claude/ branches", "worktree cleanup", or when working in a repo with obvious branch sprawl. Distinguishes merged / open-PR / orphaned states and never deletes work with an open PR.
---

# Branch cleanup

Audit and prune stale branches and prunable worktrees. The two repos with the most pressure are `harbour-apps` and `windedvertigo`, both of which accumulate `claude/*` branches from Claude Code cloud sessions.

## Goal

Reduce remote branch count to a manageable number (target: under 20 per repo) without losing any work that's still in flight.

## Steps

1. **Pick the repo(s).** Default scope: the current working directory's repo. If the user says "all repos", iterate over every `~/Projects/<repo>` that has a `.git` directory.

2. **Refresh remote info.**
   ```bash
   git fetch --prune
   ```

3. **Audit (read-only, no changes yet).**
   ```bash
   echo "== local branches =="
   git branch -vv
   echo "== remote branches (count) =="
   git branch -r | wc -l
   echo "== merged into main (remote) =="
   git branch -r --merged origin/main | grep -v 'origin/main$' | grep -v 'origin/HEAD'
   echo "== local 'gone' (upstream deleted) =="
   git branch -vv | awk '/: gone]/{print $1}'
   echo "== prunable worktrees =="
   git worktree list | grep -i prunable
   echo "== open PRs (heads) =="
   gh pr list --state open --json headRefName --jq '.[].headRefName'
   ```
   Show the user the summary.

4. **Categorize each remote branch into one of:**
   - `merged` → safe to delete on GitHub
   - `open-pr` → keep
   - `orphan-no-pr` → ask the user before deleting (commits might be valuable)
   - `recent` → branch was pushed in last 14 days, keep

5. **Propose a deletion plan.** Print a list like:
   ```
   Will delete (merged):
     claude/silly-bose-Vx6XX
     claude/pedantic-ptolemy-w9zvv
   Will keep (open PR):
     fix/wordmark-header-bar
   Needs decision (orphaned, no PR):
     claude/cobalt-blue-background-qCY6R  — last commit 2026-03-12
   ```
   Wait for user confirmation before deleting anything.

6. **Execute deletions** (only after explicit user OK).
   - Remote: `git push origin --delete <branch>`
   - Local: `git branch -d <branch>` (use `-D` only if the user explicitly opts into force-delete for an orphan)
   - Worktrees: `git worktree prune` (with `--dry-run -v` first if user wants preview)

7. **Report.** Final summary:
   - Repos audited: list
   - Remote branches deleted: count + sample
   - Local branches deleted: count
   - Worktrees pruned: count
   - Remaining remote branch count per repo

## What not to do

- **Never delete a branch with an open PR** — even if the PR is stale. Close the PR first if the user wants the branch gone.
- **Never use `git branch -D` (capital D, force) on a branch with unmerged commits** without explicit user confirmation per branch.
- **Never delete `main`, `master`, `production`, or any branch listed as the default in GitHub.**
- **Never run `git push --force` or `--force-with-lease` to clean up history.**

## Safe defaults

If the user just says "clean up branches" with no qualifier:
- Delete remote `claude/*` branches that are merged into main.
- Delete local branches whose upstream is gone (`[: gone]`).
- Prune prunable worktrees.
- Leave everything else for the user to triage.
