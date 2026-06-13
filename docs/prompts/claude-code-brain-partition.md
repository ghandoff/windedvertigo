# claude code prompt: partition the second brain for team collaboration

> paste this into a Claude Code conversation with the windedvertigo monorepo mounted.

---

we're sharing the monorepo (`ghandoff/windedvertigo`) with team collaborators: payton, lamis, maria, and soon jamie. they'll be working in github codespaces with claude code. i need to partition the second brain so that:

- **my private context** (financial, personal, health, CFO reviews, secrets) stays in the private `wv-brain` repo that only i can see
- **shared team context** (glossary, project briefs, marketing strategy, brand voice, people, terms, engineering conventions) is available to everyone working in the monorepo
- **each team member** can optionally have their own private layer if they want one

## current state

the `.brain/` directory is already gitignored from `origin` (the main monorepo). good. BUT:

### problem 1: three files are still tracked in origin
these files slipped through the gitignore and are visible to anyone who clones the repo:
```
.brain/TASKS.md
.brain/handoff.md
.brain/memory/handoff.md
```
**action:** untrack these three files from origin without deleting them locally. use `git rm --cached` for each, then commit.

### problem 2: CLAUDE.md is gitignored but the team needs shared context
`CLAUDE.md` is currently gitignored. team members opening the repo in a codespace get NO context — no glossary, no project list, no conventions, no people directory. claude code running in their codespace is flying blind.

**action:** create a **team-facing CLAUDE.md** that IS tracked in the monorepo. this file should contain:

from the current CLAUDE.md, INCLUDE (team-shared):
- `## People` table (names, roles — but not personal/family notes)
- `## Terms` table (all abbreviations and project names)
- `## Active Projects` table (project names, what, status)
- `## Monorepo Structure` section
- `## Infrastructure State` table (services, domains, hosts, workers)
- `## Deployment Workflow` section (the full standing authorization, branch conventions, merge workflow, draft PR protocol)
- `## Preferences` — only the technical preferences (lowercase aesthetic, brand voice reference)
- a pointer to `.brain/memory/marketing/` for CMO context (but this dir won't exist for them unless they set up their own brain — so include a note about that)

from the current CLAUDE.md, EXCLUDE (garrett-private):
- `## Me` section (personal identity, email — each person should define their own)
- `## AI Roles` section (CFO/COO/CMO dispatch — this is garrett's operational layer)
- `## Scheduled Tasks` section (garrett's automated tasks)
- `## Tool Stack` section (garrett-specific tool routing)
- `## Dual-Environment Architecture` section (garrett's cowork vs claude code split)
- `## Recurring Meetings` section (contains garrett's personal schedule)
- any financial references, CPA, 401k, invoicing
- the `## Memory` header that points to `.brain/` (team won't have this directory)

the team CLAUDE.md should also include:
- a `## Your Context` section explaining that each collaborator can create their own `.claude/CLAUDE.md` (user-level, not tracked) for personal preferences, and optionally their own `.brain/` directory (gitignored, local only)
- a `## How We Work` section explaining the branch → draft PR → review → merge workflow in plain language (payton and lamis are designers, not engineers)
- a note that garrett's second brain handles CFO/CMO/COO operations separately — team members interact with those outputs through slack, notion, and the port dashboard, not through the repo

### problem 3: rename to avoid collision
the current `CLAUDE.md` is gitignored. the new team-facing file needs a different approach:
- rename the current gitignored `CLAUDE.md` to `CLAUDE.private.md` (add `CLAUDE.private.md` to `.gitignore`)
- create the new team `CLAUDE.md` and REMOVE the `CLAUDE.md` line from `.gitignore` so it gets tracked
- update any references in `.brain/` that point to `CLAUDE.md` to point to `CLAUDE.private.md`

### problem 4: verify wv-brain repo is private
run `gh repo view ghandoff/wv-brain --json visibility` and confirm it's private. if not, make it private immediately.

## execution order

1. verify `wv-brain` is private
2. untrack the 3 leaked `.brain/` files from origin (`git rm --cached`)
3. rename current `CLAUDE.md` → `CLAUDE.private.md`
4. update `.gitignore`: remove `CLAUDE.md`, add `CLAUDE.private.md`
5. create the new team-facing `CLAUDE.md` with shared context (pull content from the current CLAUDE.md)
6. commit all changes to a branch, open a draft PR for my review
7. do NOT merge — i want to review the team CLAUDE.md before it goes live

## important notes
- do NOT delete any files — only untrack from git or rename
- do NOT touch anything in `.brain/memory/` or `.brain/TASKS.md` locally
- the `brain` remote (`ghandoff/wv-brain`) is a separate private repo — do not push to it or modify its tracking
- keep the current `CLAUDE.private.md` content identical to what `CLAUDE.md` has today — just rename it
- the team CLAUDE.md should feel welcoming and clear for non-engineers. payton and lamis are designers who are learning git workflows through codespaces + claude code
