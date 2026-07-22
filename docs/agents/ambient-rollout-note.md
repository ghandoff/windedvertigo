# ambient agents — rollout note & promotion runbook
_companion to `executive-ambient-agents-status.md` and `executive-charters.md` (Garrett-only). Written 2026-07-21. This is the spec §3 "written rollout note for the whirlpool" + the staged-promotion procedure + the `time_off` seed. Read before flipping `AMBIENT_ROLLOUT_STAGE` off `sandbox`._

---

## part 1 — for the team (paste into #whirlpool / #studio-comms before promoting)

> **the agents are about to start speaking up.**
>
> mo (marketing) and pam (projects) now watch our slack channels and, when something matches their charter, post a small card or send you a dm — a *proposal*, never an action taken behind your back. every card says why it showed up ("i'm here because X happened"). here's what you'll see and how to respond.
>
> **the card.** a coloured dot for how consequential it is — 🟢 low (fyi / a draft), 🟡 medium (they did something reversible and are telling you), 🔴 high (nothing happens without your yes; it auto-cancels if you don't reply by the deadline shown). then: what they want to do, the trigger, the drafted thing, and four buttons.
>
> **the four buttons.**
> - **approve** — yes, do it. the agent carries it out.
> - **edit** — you'll take it from here / it needs changes. marks the card handled; nothing auto-runs.
> - **redirect** — wrong person or wrong call. tells the agent it mis-aimed (this is how they learn to aim better).
> - **ignore** — not needed. dismisses it. **ignoring is useful signal, not rudeness** — the agents are judged on how often their cards get *acted on*, so a clean ignore teaches them to pipe up less about that kind of thing.
>
> **you won't be buried.** hard caps: ≤3 proactive nudges per agent per day, ≤5 total to any one person per day. over that, it waits quietly in the port `/inbox` instead of pinging you.
>
> **nothing external, ever, without you.** no agent sends anything to a client, publishes anything public, or touches money on its own — those are always 🔴 approve-first. pam never commits you to work; it proposes and *your* confirmation is the gate.
>
> where to see everything in one place: **port.windedvertigo.com/inbox**.

---

## part 2 — promotion runbook (Garrett only)

### the one control
`AMBIENT_ROLLOUT_STAGE` — read at runtime by `port/lib/agent/ambient-rollout.ts`; unset ⇒ `sandbox` (fail-closed). **It lives in `port/wrangler.jsonc` `vars`, not the dashboard** — because `wrangler deploy` replaces the Worker's vars with that block on every deploy, so a dashboard-only value gets silently wiped back to `sandbox` on the next unrelated deploy (we deploy often). Changing stages = edit the line + redeploy. Three stages, and **each stage flips two things at once**: which channels the agents *read*, and whether they may *DM real people*.

| stage | agents read (event_log) | channel posts go to | real DMs? |
|---|---|---|---|
| `sandbox` (now) | `#agent-sandbox` only | `#agent-sandbox` | **no** — every would-DM redirects to `#agent-sandbox` with the 🧪 marker |
| `studio-comms` | `#agent-sandbox` + `#studio-comms` | `#studio-comms` | **yes** |
| `full` | + `#whirlpool` | `#studio-comms` | yes |

### what actually turns on at `studio-comms` (the big step)
This is where real teammates first hear from the agents. On flip, all of these go live at once:
- **pam owner-confirmation sweep** starts DMing real owners to confirm their harvested meeting commitments.
- **pam monday digest** DMs each person their open commitments (Mondays) + a blocked-items note to you.
- **pam absence-horizon** DMs *you* 🔴 redistribution proposals when someone's time off collides with their deadlines (needs `time_off` seeded — see part 3).
- **mo + pam ambient sweep** starts reading `#studio-comms` and posting in-thread cards (promise detection, claim-boundary/brand flags, strategy-musing skeletons).
- **mo friday scorecard** posts to `#studio-comms`.
- **opsy weekly governance digest** DMs you graduation/threshold proposals (Mondays 12:00 UTC).

The ≤3/agent/day + ≤5/human/day budget caps are your flood insurance across all of the above.

### procedure
1. **Pre-flight (still on `sandbox`):**
   - **Invite the wv-claw bot to the target channel** (`/invite @wv-claw` in `#studio-comms`; repeat for `#whirlpool` before `full`). REQUIRED for the channel-reading + channel-posting half — Slack only delivers a channel's messages to a bot that's a member, and channel posts can fail with `not_in_channel` otherwise. The DM behaviors work without it, so it's easy to miss (it was, on the first `studio-comms` flip 2026-07-22). Verify after: post a line in the channel and confirm it lands in `event_log`.
   - Post part 1 to `#studio-comms` (and `#whirlpool`) so the team knows what's coming.
   - Seed `time_off` (part 3) so absence-horizon has data — otherwise it's a silent no-op.
   - Skim the last week of `#agent-sandbox` — are the drafts good enough to send a real person? If a behavior is embarrassing, fix it before promoting (charters are yours to tune; thresholds live in code).
2. **Flip:** edit `AMBIENT_ROLLOUT_STAGE` in `port/wrangler.jsonc` `vars` to `"studio-comms"` (commit it), then `git pull --rebase origin main` in your port checkout and `npm run deploy:cf`. The deploy applies the stage. (Same flow as any other deploy — durable, version-controlled.)
3. **Watch (first 48h):**
   - `agent_interventions` — rows should now show `executed` / `approved` / `ignored`, not just `proposed`. Confirm no agent exceeds 3 posted/day (budget working).
   - `#studio-comms` — are cards landing usefully? watch the acted-on vs ignored mix.
   - `wrangler tail --name wv-port` — watch for Slack `account_inactive` / post failures.
   - The team's reaction. If it's noisy, tighten a charter or a threshold, don't rip it out.
4. **Then `full`** (adds `#whirlpool` watching) once `studio-comms` has settled — same flip, value `full`.

### rollback
- **Instant (emergency):** Cloudflare dashboard → `wv-port` → Settings → Variables → set `AMBIENT_ROLLOUT_STAGE = sandbox` → Save. Takes effect on the running Worker immediately — everything re-redirects to `#agent-sandbox`, no real DMs. (The next deploy re-asserts `wrangler.jsonc`, so also do the durable step if the rollback is permanent.)
- **Durable:** edit the value back to `"sandbox"` in `port/wrangler.jsonc` + redeploy.
Reversible either way, no data loss — in-flight `proposed` rows just stop being posted.

### the graduation loop this unlocks
Promotion is also what makes **Opsy's governance layer** (live, Mondays 12:00 UTC) do its job: real teammates resolving cards → `agent_interventions` accumulates *resolved* instances → Opsy starts flagging graduation candidates (≥100 clean instances per action-type) and noisy/mis-targeted behaviors. Graduating an action-type to standing autonomy is then *your* call: edit `docs/agents/executive-charters.md` → `npm run sync:charters` → redeploy.

---

## part 3 — `time_off` seed template (Supabase SQL editor)

`time_off` has no entry UI in phase 1. Seed it by hand so `pam-absence-horizon` can see upcoming absences (it looks 14 days ahead and cross-checks each person's commitment deadlines). Only `owner_email`, `start_date`, `end_date` are required; `note` is optional; `id`/`created_at` default.

```sql
-- replace with real absences. dates are inclusive, YYYY-MM-DD.
insert into time_off (owner_email, start_date, end_date, note) values
  ('jamie@windedvertigo.com', '2026-08-03', '2026-08-21', 'august break'),
  ('payton@windedvertigo.com', '2026-08-10', '2026-08-14', 'annual leave');
-- verify:
select owner_email, start_date, end_date, note from time_off order by start_date;
```

To correct an entry, `delete from time_off where id = '...';` and re-insert (no update UI needed).
