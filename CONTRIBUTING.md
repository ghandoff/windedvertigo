# Contributing

Conventions for everyone working on the `windedvertigo` monorepo — Garrett, Maria, Payton, Lamis, James, and any Claude Code session (local or cloud) acting on their behalf.

GitHub auto-links this file from every PR. Treat it as the single source of truth for "how do we coordinate code changes here."

---

## Work-in-flight signaling — draft PR at the START of editing (default since 2026-05-19)

The single biggest source of friction in our parallel-session setup wasn't merge conflicts — it was teammates pinging *"are you editing X? I don't want to step on you."* The fix is to make in-flight work visible *before* it's done, via a draft PR.

This applies to both local and cloud Claude Code sessions, and to humans editing without Claude.

### Protocol

1. **Branch first, never edit `main` directly.**
   - Cloud Claude sessions get a `claude/<slug>-<id>` branch from the harness automatically.
   - Local sessions: `git checkout -b <type>/<slug>` where `<type>` is `feat | fix | chore | docs | perf | a11y` and `<slug>` is the kebab-case intent.
   - Examples: `fix/votes-toctou-race`, `feat/co-rubric-companion`, `perf/snapshot-parallelize`.

2. **Open a draft PR before substantive editing.**
   - If you don't have a first commit yet, make an empty one:
     ```bash
     git commit --allow-empty -m "wip: <intent>"
     git push -u origin <branch>
     ```
   - Open the PR in draft state. From Claude: `mcp__github__create_pull_request` with `draft: true`. From the CLI: `gh pr create --draft`.
   - **The PR title is the work-in-flight signal.** Make it descriptive: `fix(co-rubric): persist host_token client-side`, not `wip` or `fixing stuff`.
   - Body can be a one-line placeholder; the PR body will be filled in when it's ready to review.

3. **Commit and push edits as you go.** The draft PR auto-updates. Other teammates running `gh pr list --state open` (or browsing GitHub mobile) see your intent the moment you start, not the moment you finish.

4. **When the work is done**, mark the PR ready for review — drop the draft state. Then the existing actor-based merge routing applies:
   - `ghandoff` (Garrett) or `winded-maria` (Maria) → squash-merge immediately, no review gate.
   - `paytonjaeger` (Payton) or `lamissabra` (Lamis) → stop, request `ghandoff` as reviewer, surface the PR URL.
   - Any other login → stop, request `ghandoff` as reviewer.

### Carve-out — skip the draft-PR step for these

- Pure docs-only changes that don't touch source: `.brain/`, `TASKS.md`, `CONTRIBUTING.md`, `README.md`, anything under `docs/`. These land on `main` directly with `[skip ci]` in the commit message.
- Truly trivial typo / one-line fixes where PR ceremony costs more than the visibility it buys. Use judgement; default to draft PR if the change touches >1 file or >5 LOC.

### Why this matters

The PR queue (`gh pr list --state open`) becomes the **single source of truth** for "what is in flight right now?" No separate Slack ping, no shared in-flight.md, no new tooling. The convention is enforced by social pattern, not by branch protection: anyone reviewing the queue can see who's touching what.

---

## Branch naming

- `feat/<slug>` — new feature
- `fix/<slug>` — bug fix
- `chore/<slug>` — refactor, cleanup, dependency bump
- `docs/<slug>` — documentation only
- `perf/<slug>` — performance improvement
- `a11y/<slug>` — accessibility fix
- `claude/<slug>-<id>` — auto-assigned to cloud Claude sessions; do not rename

---

## Commit messages

Conventional Commits format: `type(scope): concise summary`.

```
fix(co-rubric): persist host_token client-side
perf(rubric-co-builder): parallelize getSnapshot queries with Promise.all
a11y(rubric-co-builder): UDL audit fixes #1, #3, #4, #5
```

The Claude-authored commits also include a `Co-Authored-By: Claude ... <noreply@anthropic.com>` trailer — keep that pattern.

---

## Things that are never OK

- **Pushing directly to `main`** outside the docs-only carve-out above. The repo's bypass rule exists for genuine emergencies (broken production, expired secret rotations), not as the default path.
- **Force-pushing to a shared branch.** Use `--force-with-lease` only when you know you're the only one on the branch.
- **Amending pushed commits.** Make a new commit instead.
- **Opening the GitHub web UI for routine work.** Everything goes through `mcp__github__*` tools or the `gh` CLI — that's what keeps the audit trail clean and parallel sessions from stomping each other.
- **Skipping hooks or signing** (`--no-verify`, `--no-gpg-sign`) unless explicitly requested. If a hook fails, fix the underlying issue.

---

## Per-developer local config

Each developer has their own `CLAUDE.md` (gitignored) for Claude-specific instructions. Team-wide conventions live here in `CONTRIBUTING.md` so they're version-controlled and shared. If you find yourself writing a convention into your CLAUDE.md that everyone should follow, **promote it to CONTRIBUTING.md instead.**
