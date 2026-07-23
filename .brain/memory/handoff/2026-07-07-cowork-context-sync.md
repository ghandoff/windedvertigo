# 2026-07-07 — cowork — context-sync

**session id:** scheduled context-sync (autonomous, ~21:10 pt)
**handed off from:** 2026-07-03-cowork-context-sync.md (no sync ran 4–6 jul, holiday weekend gap)

## what changed since 3 jul

- **nordic contract signed** — confirmed via box completion emails (2 jul): "Contract — Nordic Research Platform + SQR-RCT", both counterpart copies. No invoice sent yet for the $50k budget A — that's the live gap now.
- **amna wire correction sent, unconfirmed** — garrett sent hejer the full 11-character SWIFT/BIC (CHASUS33XXX) 2 jul for the £6k signature milestone. No reply/confirmation from amna's finance team since.
- **IDB el salvador — new amendment landed overnight** — "Remisión de Enmienda No. 1 y Aclaración No. 2" + LC modification notice from nadia nochez (mined.gob.sv), unread as of this run. Maria acknowledged the prior aclaración 6 jul.
- **taxdome — 2025 return signature still pending** — reminder landed 7 jul 16:34pt; the agent's taxdome session keeps expiring (self-dm nudges sent 08:09 and 17:09 pt today, same as the standing carry-forward).
- **big engineering cleanup day** — 16 commits to main today (#327–#340): retired the old `apps/harbour` full snapshot for good (git-activity-confirmed `harbour-apps` is now sole source of truth — only `packages/security`, `values-auction`, `read-the-room`, `images` remain wired in), decoupled `ancestry` into its own repo, moved design tokens to single-source file-sync (`npm run sync:tokens`), shipped an architecture-map tab + live token-drift signal to `/ops`, fixed the RFP kanban 100-row fetch bug, and retired the leaked personal gmail token in favor of service-account impersonation. Port deploy unverified this run — `/api/version` unreachable from the sandbox (recurring bot-WAF limitation, not new).
- **caipb-audit-fixes correction** — checked directly: `feat/caipb-audit-fixes` **is** present on `origin` (contrary to the "~15 days unpushed" note carried in prior snapshots). Still needs garrett's review/merge call; do not merge to main (auto-deploys nordic).
- **handoff hygiene gap found** — `.brain/memory/handoff/` session files from 2026-05-26 through 2026-07-03 (7 files) were sitting uncommitted/untracked despite being written. Committed them this run along with today's refresh.

## sources

git log + `git status --ignored` (windedvertigo repo), `.brain/TASKS.md`, `.brain/memory/{financial,decisions}.md`, `.brain/memory/projects/nordic-naturals.md`, `.brain/memory/handoff/_live-state.md` + sibling session files, gmail (`is:unread newer_than:1d` + targeted searches: nordic, amna, IDB/SDP, gusto, cash/balance), slack self-dm search (`in:@U06Q4UN4PKR after:2026-07-06`), slack public+private search (`nordic OR amna after:2026-07-03` — no hits), gcal (8 jul — whirlpool 9–10:30am pt, fruitstand 11am–12:30pm pt). curl to `port.windedvertigo.com/api/version` — unreachable from sandbox.

## sources unavailable this run

- **notion** — MCP connector required re-authorization (non-interactive session, could not complete OAuth); no notion projects-db status changes captured this run.
- fresh cash figure — still $34,026 from 20 apr; no fresher number surfaced in gmail/slack.
- port `/api/version` — unreachable from the sandbox (bot-WAF, recurring).
