# Contributing

Conventions for everyone working on the `windedvertigo` monorepo — Garrett, Maria, Payton, Lamis, James, and any Claude Code session (local or cloud) acting on their behalf.

GitHub auto-links this file from every PR. Treat it as the single source of truth for "how do we coordinate code changes here." For the **what** of winded.vertigo — people, terms, projects, infrastructure — see [TEAM.md](./TEAM.md).

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

## Best practices

These are the day-to-day habits that keep the multi-session, multi-collaborator setup working. They build on the protocol above — most are 30 seconds of effort that save someone (often future-you) much more.

### Starting a session

Whether you're opening a local terminal, a Codespace, or claude.ai/code, glance at four things before substantive editing:

1. **The SessionStart hook output.** Claude Code prints it at the top of every session (see `.claude/hooks/session-start-diagnostic.sh`): current branch + upstream, dirty file count, local-main divergence from `origin/main`, and currently open draft PRs. If you don't see it, your session predates the hook — run `git fetch && git status && gh pr list --draft --state open` manually.
2. **The freshest two or three handoff files in [`.brain/memory/handoff/`](./.brain/memory/handoff/).** Newest-first. If you're picking up where someone left off, the handoff is the fastest way in. The format is documented in [`.brain/memory/handoff/README.md`](./.brain/memory/handoff/README.md).
3. **[`.brain/TASKS.md`](./.brain/TASKS.md)** — whirlpool action items, organized by date and assignee. If your name's next to something, that's a candidate for this session.
4. **Open PRs touching files you plan to touch.** `gh pr list --state open --search "<filename or path>"` is enough. If two of you would be editing the same component, coordinate via Slack DM before doubling the work.

### During work

- **One branch, one intent.** If the intent shifts mid-session — you started a fix, found a refactor opportunity, and now want to do both — open a second branch for the second thing. Long, kitchen-sink branches are hard to review and hard to merge.
- **Treat the draft PR title as your billboard.** It's what your teammates see in `gh pr list`. `fix(port): patch token refresh on stale session` is signal; `fix: stuff` is noise. Edit the title whenever your intent sharpens.
- **Commit small, push often.** The draft PR auto-updates. If you push every 15–30 minutes during active work, the in-flight signal stays accurate and you minimize the work lost if something goes sideways.
- **Rebase, don't merge, when you fall behind `main`.** If `origin/main` advances while you're working, run `git pull --rebase origin main` from your feature branch. Don't merge `main` *into* your branch — it pollutes the history with merge commits and makes the squash-merge harder to read.
- **The `Session:` commit trailer.** If your commits are part of a coherent session — especially if you're running concurrently with someone else — add a `Session: <short-slug>` line to the commit message. `git log --grep="Session:"` then becomes a forensic tool when something goes wrong.

### Wrapping a session

- **Drop a handoff file when the work warrants it.** Not every session needs one. Write a handoff when: (a) you finished something a teammate will need to know about, (b) you stopped mid-flight and want to make it easy to resume, (c) you discovered something surprising about the codebase or the system. Skip it for routine fixes. Format and naming are in [`.brain/memory/handoff/README.md`](./.brain/memory/handoff/README.md); `git add -f` the new file the first time.
- **Mark the PR ready for review** when the work is done. If you're stopping mid-flight, leave it draft and write a one-line "where I left off" in the PR description.
- **Don't end the day with unpushed commits on a feature branch.** Push them. The remote is the only copy your next session (or another teammate) can see.
- **For Garrett and Maria:** if the PR is ready and the actor-routing rules apply to you, squash-merge immediately. Don't queue PRs for next-day; the longer they sit, the more they drift from `main`.

### Working without an engineering background (Payton, Lamis, future collaborators)

You can do everything described above without learning git deeply — Claude Code handles the mechanics. A few things help:

- **Open the repo in a Codespace** (green "Code" button on the GitHub repo page → "Codespaces" → "Create"). Claude Code is preinstalled. You don't need to install anything locally.
- **Tell Claude what you want in plain English.** "Add a new tile to the harbour grid that points to the play, fair page" is enough. Claude will create the branch, edit the files, open the draft PR, and push — you watch the PR appear and review what changed.
- **Use GitHub mobile to review.** The "Pull requests" tab on mobile shows your open PRs, the file diffs, and the conversation. You can comment, request changes, or just mark "Looks good" — all from your phone.
- **Garrett reviews and merges your PRs.** Per the actor-routing rules above, your PRs are gated to him. That's intentional — the review is part of the learning loop, not a blocker. Keep iterating on the same branch and the PR updates automatically; he'll review when he has a moment.
- **Spawn new Claude sessions liberally.** Sessions are cheap. If a task is unrelated to what you were just doing, open a new session rather than juggling intents in one.

### When you learn something the team should know

This is where the partition design pays off. Three places to write, depending on what you learned:

| What you learned | Where it goes |
|------------------|---------------|
| A workflow convention everyone should follow ("we should always run `npm run typecheck` before pushing infra changes") | Propose a new section in **`CONTRIBUTING.md`** |
| A fact about the team / a glossary term / an infra entry / an active project ("the Slack agent is now called `wv-claw`, not `OpenClaw`") | Propose an edit to **`TEAM.md`** |
| A preference for how Claude should behave **for you specifically** ("respond in lowercase by default") | Write it in your own gitignored root **`CLAUDE.md`** |

Promoting too aggressively (writing into TEAM.md when the fact is actually personal) is a low-cost mistake — Garrett can revert in the review. Promoting too conservatively (hoarding shared knowledge in your personal CLAUDE.md) is the more expensive failure mode because the team can't learn from it.

### Anti-patterns to avoid

- **Editing the same file in two concurrent sessions without coordinating.** The PR queue (`gh pr list`) and the SessionStart hook exist specifically to prevent this. If you notice it happening, stop and DM the other session's owner.
- **Letting a branch live for more than a few days.** Three days of drift can usually be rebased away. A week of drift usually means the work should be split, abandoned, or merged-and-iterated. If a branch has been open for two weeks, close it or finish it.
- **Closing a draft PR without explanation.** Leave a one-line comment ("superseded by #N", "scope abandoned, see TASKS.md"). The next session deserves to know why.
- **Writing into TEAM.md / CONTRIBUTING.md without a draft PR.** These files are shared institutional memory — they deserve review, not direct pushes. The docs-only `[skip ci]` carve-out exists for typos and pure additions to your own `.brain/` files, not for editing shared canonical docs unilaterally.
- **Treating `.brain/memory/handoff/` as a running chat log.** Each file is a session boundary, written once at the end of a session — not a Slack channel. If you want a running conversation, use Slack.

---

## Things that are never OK

- **Pushing directly to `main`** outside the docs-only carve-out above. The repo's bypass rule exists for genuine emergencies (broken production, expired secret rotations), not as the default path.
- **Force-pushing to a shared branch.** Use `--force-with-lease` only when you know you're the only one on the branch.
- **Amending pushed commits.** Make a new commit instead.
- **Opening the GitHub web UI for routine work.** Everything goes through `mcp__github__*` tools or the `gh` CLI — that's what keeps the audit trail clean and parallel sessions from stomping each other.
- **Skipping hooks or signing** (`--no-verify`, `--no-gpg-sign`) unless explicitly requested. If a hook fails, fix the underlying issue.

---

## Per-developer local config

Each developer has their own `CLAUDE.md` (gitignored) for Claude-specific instructions. The team has two shared, tracked files at the repo root:

- **`CONTRIBUTING.md`** (this file) — conventions for **how** we work (branches, PRs, commits).
- **[`TEAM.md`](./TEAM.md)** — shared knowledge about **what** we're working on (people, terms, projects, infrastructure).

If you find yourself writing into your personal `CLAUDE.md`:

- A convention everyone should follow → **promote to CONTRIBUTING.md**.
- A fact about the team, a glossary term, or an infra entry → **promote to TEAM.md**.
