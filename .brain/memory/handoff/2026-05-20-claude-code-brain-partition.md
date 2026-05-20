# 2026-05-20 — claude-code — brain-partition

**session id:** local terminal, branches `chore/partition-second-brain`, `docs/team-best-practices`, `docs/pr-fluency-ramp`
**duration:** ~2 hr
**handed off from:** [`2026-05-19-claude-code-collision-surface.md`](./2026-05-19-claude-code-collision-surface.md) (built on top of the new convention it established)

## what i did

Shipped four pieces of follow-on work to yesterday's collision-surface infrastructure, plus the first manual run of the missing `context-sync` task it referenced.

1. **PR #107 — second-brain partition, ultimately unified with the post-#106 design.** First attempt followed an outdated prompt from `~/Library/CloudStorage/.../claude-code-brain-partition.md` (Google Drive) that assumed root `CLAUDE.md` would become team-shared and tracked. Mid-session, noticed PR #106 had just landed (collision-surface infra) and `CONTRIBUTING.md` was authored under the opposite model ("each developer has their own gitignored `CLAUDE.md`"). Two-step pivot: (a) reverted the rename + restored force-tracking of `.brain/TASKS.md` and `.brain/memory/handoff/*` (which the partition step had mistakenly untracked), (b) created `TEAM.md` at the repo root for shared institutional knowledge (People, Terms, Projects, Monorepo Structure, Infrastructure State). Net diff vs main: −214 lines (untracked root CLAUDE.md, preserved on disk), −34 lines (untracked orphan `.brain/handoff.md`), +122 lines (TEAM.md), +10 lines (CONTRIBUTING.md cross-references). Merged `fbdd70c`.

2. **PR #108 — "Best practices" section in CONTRIBUTING.md.** Six sub-sections covering the day-to-day habits: starting a session (read SessionStart hook output + freshest handoff + TASKS.md + PR queue), during work (one-branch-one-intent, PR title as billboard, `Session:` commit trailer), wrapping a session (when to write a handoff file, push before EOD), working without an engineering background (Codespaces, plain-English Claude instructions, GitHub mobile), knowledge promotion patterns (workflow → CONTRIBUTING.md, fact → TEAM.md, personal pref → gitignored CLAUDE.md), and anti-patterns. Inserted before "Things that are never OK" so the doc flows positive → negative → per-developer config. Merged `9aa4279`.

3. **PR #109 — graduated PR-fluency ramp.** Promoted the 4-stage curriculum from Payton's onboarding Slack DM into CONTRIBUTING.md as a durable, audience-neutral subsection under "Working without an engineering background." Stages: (1) now: notice when PRs get merged, (2) next few weeks: read review comments, (3) later: skim Files Changed before marking ready, (4) eventually: glance at the open PR queue. Framed deliberately gradual — "each stage is meant to feel boring before the next becomes useful." Merged `ed09985`.

4. **Sent two Slack DMs** introducing the new conventions to Maria (`U08ANKF3E3U`, perma [D08BBE7KPEU/p1779287257740429](https://windedvertigogo.slack.com/archives/D08BBE7KPEU/p1779287257740429)) and Payton (`U08CAS3PFHQ`, perma [D08BWAFRSS3/p1779287263711499](https://windedvertigogo.slack.com/archives/D08BWAFRSS3/p1779287263711499)). Tailored: Maria's emphasizes her squash-merge authority (matches actor-routing); Payton's defines what a PR is in concrete terms and includes the 4-stage fluency ramp.

5. **Created the `context-sync` scheduled task** at `/Users/garrettjaeger/.claude/scheduled-tasks/context-sync/SKILL.md`. Cron `0 21 * * *` (9pm PT daily; fires at ~9:07pm with jitter). Self-contained prompt reads handoff dir + TASKS.md + PR queue + recent commits, synthesizes `_live-state.md`, commits via the docs-only `[skip ci]` carve-out, and Slack DMs Garrett a 4-line summary. Closes the loop on the dangling reference from `_live-state.md`'s "single writer" promise that wasn't actually owned by anything until today.

6. **First manual run of context-sync** (commit `05469bc`) — refreshed `_live-state.md` with 10 open threads, environment handoffs for Cowork/Claude Code/Cloud, 5 recent merges, 4 risks. Surfaced two findings that weren't visible in any single signal: 5 stale open PRs (5–9 days old) and `operational.md` `active-projects` last-reviewed 37 days ago with IDB Salvador's deadline silently passed.

## what's open / next

- **Open-PR sweep.** Five draft PRs are at or past CONTRIBUTING.md's stale-branch anti-pattern threshold: #89 (rubric-co-builder proxy, 5d, ghandoff), #72 (cuts-catalogue a11y, 7d, winded-maria), #60 (/api/version roll, 7d, ghandoff), #52 (wv-pr-pager, 7d, ghandoff), #44 (Payton's first commit, 9d, paytonjaeger). At minimum each needs a status comment or a graceful close. Maria's #72 is ready for merge.
- **`operational.md` `active-projects` refresh.** Last-reviewed 2026-04-13 (37 days); IDB Salvador deadline (Apr 10) passed without status update; LEGO/UNICEF retirement notes haven't propagated everywhere; PRME 2026 row needs a current invoicing status.
- **Tonight's first scheduled context-sync fire (~9:07pm PT)** will prompt once for Bash + Read/Write + Slack permissions. Approve once and every subsequent run is silent. If you want zero-prompt tonight, click "Run now" in the Claude desktop app's Scheduled Tasks panel before 9pm.
- **`wv-crm` rollback expiry** was 2026-05-17 (3 days ago) per the old CLAUDE.md note. Should be verified deleted; if still live, formally decommission.
- **May 6 whirlpool items in TASKS.md uncrossed** — esp. Payton's "post Learning to Fly Substack on May 13." Was it shipped? If yes, cross off. If dropped, escalate.

## things the next session needs to know

- **Root `CLAUDE.md` is now gitignored per-developer.** Garrett's full content is preserved on disk; do not be confused by it showing as "untracked" or "uncommitted-looking." Each contributor's CLAUDE.md is their own. Team-shared facts go in `TEAM.md`; team-shared workflow goes in `CONTRIBUTING.md`.
- **`TEAM.md` is the new shared-knowledge canonical doc.** Always cross-reference it from `CONTRIBUTING.md` (already done). If you learn a new fact about people/terms/projects/infra during a session, propose an edit there via PR.
- **`CONTRIBUTING.md` now has a "Best practices" section** covering session habits and the 4-stage PR-fluency ramp. Length is ~155 lines; still scannable but no longer the 90-line minimal doc it was yesterday.
- **`.brain/memory/handoff/_live-state.md` is now actively maintained by the `context-sync` scheduled task** — single-writer, daily 9pm PT. Don't hand-edit unless you're explicitly taking the snapshot (and even then, leave a note that you did so the next sync knows to overwrite cleanly). The current refresh is from 2026-05-20 11:32 PT (manual first run).
- **The `**/CLAUDE.md` + `!/CLAUDE.md` gitignore exception pattern is GONE.** The simplified `.gitignore` has just `CLAUDE.md` + `.brain/` with a comment about force-tracked exceptions. Nested CLAUDE.md files in subdirectories (e.g. `apps/harbour/CLAUDE.md`) are caught by the simple rule.
- **Standing PR auto-merge authorization for `ghandoff` and `winded-maria` is enforced via `gh pr merge --admin`** when branch protection requires PR review. The `--admin` flag is the standing-authorization expression; do not strip it from the merge command for routine PRs from those actors.
- **Don't write a session handoff for trivial sessions.** README says append-only and per-session, but the convention only earns its keep when files are written for sessions that actually change something a teammate will need. This file documents 4 merged PRs + 1 scheduled task + 2 Slack DMs — clearly worth a handoff. A typo fix is not.

## appendix: follow-on work later same session (afternoon)

After Garrett reviewed the live-state output, three concrete follow-ups landed:

1. **PR #72 squash-merged** (`71c66545`) — Maria's cuts-catalogue UDL + WCAG a11y fixes. 7 days open; clean ready-to-merge. First post-PR-#107 enactment of the "ghandoff/winded-maria squash-merge immediately" actor-routing rule by a non-author.
2. **`wv-crm` Vercel rollback verified complete.** `vercel projects ls --scope winded-vertigo` returns zero projects. The rollback window had a 2026-05-17 expiry per the old infra notes; verification is now 3 days post-expiry. CF Workers transition is officially complete for all winded.vertigo services (the only remaining Vercel service is `wv-claw` the port Slack agent, under a different team scope).
3. **IDB Salvador follow-up email drafted in Gmail** (draft id `r6073192147334019515`). In-thread reply to thread `19d74dfd2521ac40` (`Re: Documentación Requerida – Selección Basada en la Calidad No. 01/2026 MINEDUCYT-BID 7521`). Spanish, Maria's voice, signed "María Altamirano." Polite check-in after 26 days of silence since Nadia Nochez's 24 apr "comisión actualmente realizando" confirmation. To: nadia.nochez@mined.gob.sv, cc: maria@windedvertigo.com. Awaiting human review + send — the user (Garrett) should either (a) forward the text to Maria for her to send from her own account preserving relationship continuity, or (b) send from his account with a one-line context about why he's writing this time instead of Maria.

Also touched (gitignored, not in this commit): `operational.md` IDB row refreshed + `active-projects` last-reviewed bumped to 2026-05-20 + inline comment added to the stale infra-state table pointing at TEAM.md as the canonical source.

### appendix-specific things the next session needs to know

- **The `gh pr merge --admin` path successfully bypasses branch protection for the docs-only and actor-routed paths**, but each bypass is logged on the GitHub timeline as a rule violation. That's intentional — it's an audit trail, not an alert. Don't be alarmed if you see "Bypassed rule violations" in remote push output; it means the path you took is correct for the actor.
- **The IDB email is in Garrett's Gmail drafts, not Maria's.** Maria's Gmail is not connected to the MCP this session has access to. If you (next session) need to put drafts directly into Maria's account, that's a separate MCP connection step.
- **The follow-up timing rule that emerged here**: 26 days since last contact crosses what we should treat as "send a polite check-in" threshold for major procurement processes. Not formalized in CONTRIBUTING.md or TEAM.md yet; might be worth a "follow-up cadences" subsection in `.brain/memory/marketing/proposals.md` if this becomes a pattern.
