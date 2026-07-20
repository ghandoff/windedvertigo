# handoff — executive agents phase 1 (ambient spine)
_written 2026-07-20 ~00:45 PDT · resume point for a fresh Claude Code session on the Mac mini · companion to `executive-agents-phase1-build.md`_

## how to resume
Start a session in `~/Projects/windedvertigo`, tell Claude to read this file plus
`docs/prompts/executive-agents-phase1-build.md` and `docs/agents/executive-charters.md`
(charters are Garrett-only, read-only). Then `git pull --rebase origin main` first.

## where things stand (DONE)
- **Code**: phase 1 built + merged — PR #393 (spine + Mo/PaM pilots), PR #394 (Slack token fix). All on `origin/main`.
- **Deployed**: live on Cloudflare, `built` = 2026-07-20T07:00 UTC. Confirm with `curl -s https://port.windedvertigo.com/api/version`.
- **Migrations**: all 4 applied to Supabase `wv-port-pilot` (`fpqbokzjipovjhvujqtm`) — `agent_escalations`, `agent_interventions`, `event_log`, `time_off`.
- **Slack app (wv-claw)**: scopes added (`channels:history`, `channels:read`, `users:read.email`), `message.channels` event subscribed, Interactivity URL set to `/api/agent/slack/interactive`, reinstalled. Bot token rotated on reinstall and updated in Cloudflare via `wrangler versions secret put SLACK_AGENT_BOT_TOKEN --name wv-port`.
- **#agent-sandbox**: created (channel id `C0BJHKZGZ28`), collective members removed — just Garrett + wv-claw now.
- **Rollout gate**: `AMBIENT_ROLLOUT_STAGE` is UNSET → defaults to `"sandbox"` → every channel post and every "would-DM" is redirected to #agent-sandbox. **No real teammate has been DMed.** Verified: the account_inactive failures earlier never reached anyone, and the sandbox now shows real cards posting correctly.
- **Slack MCP connector**: connected in the Claude desktop app, so a session can read Slack directly now.

## the token bug we fixed (context)
`lib/slack.ts` used `SLACK_BOT_TOKEN` (an older, separate "digest bot"). That credential is DEAD — every call returned `account_inactive` (confirmed via `wrangler tail`). PR #394 repointed it to prefer `SLACK_AGENT_BOT_TOKEN` (wv-claw, live). This also silently fixed the pre-existing digest crons (whirlpool-checkin, weekly-digest, etc.) which used the same dead token. **Follow-up worth checking:** if the digest bot needs its own posting identity/name back, give `SLACK_BOT_TOKEN` a live credential and flip the preference back.

## TWO OPEN BUGS found in the sandbox run (fix next)
1. **Notification budget NOT enforced on standalone crons.** Charter says ≤3 interventions/agent/day, ≤5/human/day. That cap is only checked inside `lib/agent/ambient-run.ts` (`getRecentInterventionCount` / `getRecentInterventionCountForHuman`). The standalone crons — `pam-owner-confirmation-sweep`, `pam-monday-digest`, `pam-absence-horizon`, `mo-*` — call `insertIntervention` directly and skip that check. Result: **50+ pam/preview/proposed rows already accumulated** and climbing (10 per 15-min tick, draining the 1,330-row `meeting_action_items` backlog). Harmless in sandbox, but must be capped before promoting off sandbox. Fix: factor the budget check into a shared helper and apply it in the standalone crons too.
2. **Sandbox marker is invisible.** In sandbox mode the "would-DM" cards post to #agent-sandbox, but the `[sandbox — would DM x]` prefix lives in the Block Kit *fallback text* — Slack renders the `blocks` and hides the fallback, so a reader can't tell a sandbox draft from a real post. Fix: move the marker into an actual context block in `lib/agent/intervention-card.ts` (or prepend a marker block when in sandbox stage).

Minor: same-titled action items appear multiple times in the sandbox (e.g. "provide feedback on doodle polling tool" ×3). Likely genuinely distinct `meeting_action_items` rows, but worth confirming the dedup (`listRecentByAgent` → `meetingActionItemId` set) is doing what we expect.

## remaining acceptance criteria to run (spec §4) — task #14
Only PaM's owner-confirmation path (criterion 2) has actually fired. Still to verify:
- **1** win-event → Mo produces a preview card with a drafted case-study stub; approve executes.
- **3** a HIGH-tier card left past `expires_at` auto-expires (default-deny). `pam-absence-horizon` produces HIGH-tier rows — easiest path, or insert a synthetic row with a short expiry and let `agent-interventions-expire` (hourly) flip it.
- **4** budget test — 4th intervention/day queues silently instead of pinging. **NOTE: blocked by open bug #1 above — the cap isn't enforced on the crons yet.**
- **5** `/inbox` shows both card types with working buttons (visit port.windedvertigo.com/inbox — there are 50 proposed interventions to render right now).
- **6** metrics query returns per-agent rates — `GET /api/agent/interventions/metrics` with `Authorization: Bearer $CMO_API_TOKEN`.

## then, to graduate off sandbox (human gates)
- Fix bug #1 (budget cap) FIRST — otherwise promoting will fire dozens of real DMs.
- Seed `time_off` rows (SQL editor) so absence-horizon has data. No entry UI yet (phase-1 minimal).
- Promote `AMBIENT_ROLLOUT_STAGE` env var: `sandbox` → `studio-comms` → `full`. Set it in Cloudflare (Workers → wv-port → Settings → Variables), then redeploy or `wrangler versions deploy`.
- Write the whirlpool rollout note (what the team will see, how to respond to cards) before `full`.

## the one workflow friction to know
`npm run deploy:cf` gets blocked by this environment's permission classifier when Claude runs it — Garrett has been running the deploy manually (`cd ~/Projects/windedvertigo/port && npm run deploy:cf`). DB migrations via the Supabase MCP mostly work but `time_off`/`event_log` got classifier-blocked once each and were applied by hand. Plan around this: Claude writes + commits + pushes, Garrett runs the deploy.
