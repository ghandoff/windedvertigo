# Handoff — per-session files

Cross-environment context for Cowork ↔ Claude Code ↔ cloud Claude ↔ humans. Each session writes its **own** file. Aggregate state is derived by listing the directory.

This replaces the single `handoff.md` that used to live here. That file was edited 14 times in the last 30 days by ≥2 concurrent sessions and was the most frequent recurring merge-conflict source in the repo. One writer per file eliminates the structural conflict.

## Files in this directory

| Pattern | Owner | Purpose |
|---|---|---|
| `_live-state.md` | the `context-sync` scheduled task (single writer) | Pinned snapshot of "where are we right now" — auto-refreshed daily 9pm PT. **Do not hand-edit unless you are explicitly taking the snapshot.** |
| `_archive-pre-split-YYYY-MM-DD.md` | nobody — read-only | Everything that lived in the old single `handoff.md` before the split. Search this when looking for older session notes. |
| `YYYY-MM-DD-<env>-<slug>.md` | the session that wrote it | One per significant session. Append-only. Read the freshest few when picking up work. |

## Note on `.gitignore`

`.brain/` is in the repo's `.gitignore` (legacy from when memory was on a separate remote), but specific files are force-tracked. New session files in this directory need `git add -f <file>` the first time:

```bash
git add -f .brain/memory/handoff/2026-05-19-claude-code-my-slug.md
```

Once tracked, subsequent edits to the same file behave normally — no `-f` needed.

## Writing a session file

When a Cowork or Claude Code session finishes meaningful work, drop a file:

```
.brain/memory/handoff/2026-05-19-claude-code-collision-surface.md
```

Name format: `YYYY-MM-DD-<env>-<short-slug>.md`

- `<env>` is one of: `cowork`, `claude-code`, `cloud-claude`, `human`
- `<slug>` is a 2–4 word kebab-case intent (`collision-surface`, `co-rubric-toctou-fix`, `amna-prep`)
- Same-day same-env collisions: add a `-2`, `-3` suffix or use a more specific slug

Inside the file:

```markdown
# <date> — <env> — <slug>

**session id:** <whatever distinguishes this session — tmux pane, branch, harness ID>
**branch:** <branch name if engineering>
**duration:** <rough>
**handed off from:** <prior file if continuing>

## what i did
- bullet 1
- bullet 2

## what's open / next
- bullet 1

## things the next session needs to know
- gotchas, half-done state, watch-outs
```

Free-form is fine — the structure above is a suggestion, not a schema.

## Reading on session start

When picking up work say *"pick up [project]"* or *"where did we leave off?"* — the responding session should:

1. Read `_live-state.md` (single pinned snapshot)
2. List `.brain/memory/handoff/` sorted by mtime descending, read the freshest 2–3 files
3. Optionally grep recent files for the specific project/slug

## Why this exists

Single-file handoff → every session merges its edit into the same blob → race conditions and conflicts.

Per-session files → each session owns its own blob → no conflicts, no coordination needed.

The trade-off: aggregating state across files takes one extra step (sort by mtime, read top N). That step costs ~1 tool call. The conflict-free property is worth it.
