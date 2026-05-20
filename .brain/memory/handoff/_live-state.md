# Live state — refreshed 2026-05-20 11:32 PT by context-sync (first manual run)

> Single-writer file. Owned by the `context-sync` scheduled task (Cowork or Claude Code, daily 9pm PT).
> Manual edits should only happen when explicitly taking the snapshot; otherwise let the schedule rewrite it.
>
> History and per-session notes live in sibling files in this directory. The archive of everything pre-split is `_archive-pre-split-2026-05-19.md`.

## open threads

- **Prime+ launch May 28 (T-8 days)** — multiple subtasks active across team. → garrett to request technical audit from August
- **Strategy app debugging** — loading issues in port. → garrett to troubleshoot
- **Website "Do" page load fix** — windedvertigo.com /do not loading. → garrett to fix
- **Homepage copy refresh** — "What" page hero ("learning is change" → more explicit) + 3-bullet middle sentence (research / products / experiences). → garrett to update
- **Pause-motion accessibility button** — stop motion effects on wobbling/spinning elements. → garrett to implement
- **Ubango proposal draft** — sketch inside Notion. → jamie to draft
- **Edtech journals shortlist** — top 20 for article placement. → lamis to identify
- ~~**Maria's cuts-catalogue a11y PR (#72)** — 7 days open.~~ → **resolved 2026-05-20**: squash-merged as `71c66545`
- **Garrett's stale draft PRs** — #89 (rubric-co-builder proxy, 5d), #60 (/api/version roll, 7d), #52 (wv-pr-pager, 7d). → ship / close / revive each
- **Payton's first-commit playground PR (#44)** — 9 days open. → blocked on review or graceful close
- ~~**`wv-crm` rollback expiry verification**~~ → **resolved 2026-05-20**: `vercel projects ls --scope winded-vertigo` returns zero projects; CF Workers transition complete
- **IDB Salvador follow-up** — 26d silence since Nadia's 24 apr "comisión actualmente realizando." → follow-up email drafted in Gmail (Maria's voice, Spanish, in-thread reply); awaiting send

## environment handoffs

**Cowork (operations):**
- `operational.md` `active-projects` block last-reviewed 2026-04-13 (37 days). Refresh from current state — IDB Salvador deadline has passed, several entries are stale.
- May 6 whirlpool items still uncrossed in TASKS.md — verify Payton's "post Learning to Fly on May 13" status; cross off if shipped, escalate if dropped.
- Wednesday whirlpool agenda: confirm it includes the 15-min Prime+ app review block per the May 18 action item.

**Claude Code (engineering):**
- Triage the 5 stale open PRs (all 5–9 days). At minimum: comment on each with a status or close it. CONTRIBUTING.md anti-pattern threshold is 3+ days = rebase, 7+ days = split/abandon/merge.
- Today's session merged 3 PRs (#107 TEAM.md, #108 best-practices, #109 PR-fluency ramp) and shipped the `context-sync` scheduled task. No engineering follow-ups in flight.

**Cloud Claude / mobile sessions:**
- Nothing explicitly pending. The new SessionStart hook means any new session will surface its own collision-surface picture on boot.

## recent merges (24–48h)

- `ed09985` — docs(contributing): graduated ramp for getting fluent with PR review (#109) (ghandoff)
- `9aa4279` — docs(contributing): add best practices for working in this environment (#108) (ghandoff)
- `fbdd70c` — chore: add TEAM.md for shared institutional knowledge (#107) (ghandoff)
- `60ed480` — chore(parallel): hybrid collision-surface reductions (#106) (ghandoff)
- `4453399` — feat(strategy): move Gantt + distribution data from hardcode to Supabase (#105) (ghandoff)

## notable risks

- ~~`operational.md` `active-projects` last-reviewed 2026-04-13 (>30d)~~ → **partially addressed 2026-05-20**: IDB row refreshed + last-reviewed bumped to today; the infra table within operational.md still needs a full refresh (called out via inline comment pointing to TEAM.md as canonical).
- 4 of 5 open PRs still 5–9 days old (sweep partially done — #72 merged); #89/#60/#52/#44 remaining. Anti-pattern threshold still tripped.
- TASKS.md May 6 whirlpool items still uncrossed; possible silent drift where work shipped but wasn't logged (esp. Payton's May-13 Substack post).
- ~~No per-session handoff file for today's brain-partition work~~ → **resolved 2026-05-20**: `2026-05-20-claude-code-brain-partition.md` filed, force-tracked, appended with follow-on work (#72 merge, wv-crm verification, IDB draft).
