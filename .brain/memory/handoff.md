# Handoff Notes — Cross-Environment Context

When Cowork or Claude Code finishes a significant session, drop a note here so the other environment picks up with full context. Most recent first.

> **cross-device convention:** this file is the source of truth when resuming work. say "pick up [project]" or "where did we leave off?" at the start of any Cowork or Claude Code session to trigger a read. the `context-sync` scheduled task updates the **live state** block below daily at 9pm PT.

---

## 🟢 live state
<!-- updated by context-sync daily 9pm PT, and manually at end of significant sessions. only this block is auto-refreshed. everything below is append-only history. -->

**last synced:** mon 27 apr 2026, ~21:00 PT (cowork, context-sync dispatch)

**where we are right now:**
cash still strong at ~$28K post-PRME; the week's centre of gravity is **PPCS session 1 thu apr 30**, with anchor-leg prep continuing tue 11am and a dry run wed 1pm. today's whirlpool produced a fresh action set — payton owns wed's meeting solo while garrett is at the UC-riverside PD panel (gina has now declined the joint invite). the harbour pre-launch path remains gated by three small user actions (oauth redirect URI, 16-app deploy script, slack webhook), and tomorrow stacks four meetings between 9am and 1pm — lamis, randall, maria, then the PRME hold with meredith + sam — making it the natural moment to lock survey/comms decisions. external blockers thinning: anthropic api rate-limit increase landed overnight (tier 4 now active). still red: amna at 10 follow-up is 32 days overdue, gusto health insurance closes in 3 days, and vercel harbour-apps preview keeps failing post-CF migration.

### open threads

| project | last action | next action | link |
|---------|-------------|-------------|------|
| PPCS session 1 launch | countdown tool shipped (`350c772`); site fix `30b5dfc` (static-assets cache, drop R2 binding) deployed today; anchor-leg prep done with maria | verify `windedvertigo.com/tools/ppcs-launch/` resolves on prod (smoke probe blocked by allowlist); run wed 1pm dry run with maria | gcal |
| harbour 3B oauth gate | code + secrets deployed; google OAuth client gate pending | **30-sec user action**: add redirect URI to client `160968051904-…`: `https://www.windedvertigo.com/harbour/api/auth/callback/google` | gcp console |
| 16-app CF wrapper rollout | prep committed `042392e`; deploy script ready | run `cd harbour-apps && ./scripts/deploy-cf-wrappers.sh --include-depth-chart` | terminal |
| smoke alert webhook | `wv-launch-smoke` worker live, cron */30, 40/40 green; reads `WV_CLAW_WEBHOOK` if set | create incoming webhook on wv-claw slack app, run `wrangler secret put WV_CLAW_WEBHOOK --name wv-launch-smoke` | slack |
| PRME 2026 — programme start | metz qualtrics thread still unanswered; PRME hold meeting tomorrow 12pm PT with meredith + sam | use tue 12pm PRME hold to lock survey platform + facilitation guide cadence; sync maria pre-call at 11am | gcal |
| dev-collaboration handbook | section 8 (IP & promotion when building for prme) shipped today (`b7c1108`); rendered to `/handbook/dev-collaboration` (`ec45c7a`) | circulate to maria + payton; reference from PRME comms re: discussion-post formatting | site |
| vercel harbour-apps preview | preview deployment failures continued today (2x at 16:04 UTC) post-CF migration | claude code: investigate build logs, decide whether to delete vercel project or fix env-var drift | vercel |
| health insurance | gusto june 1 coverage deadline is **thu apr 30**; mike bryant resent reminder today | confirm benefits selection in gusto — **3 days left** | gusto |
| amna at 10 | proposal sent mar 26 to jonelle + walaa | **32 days overdue** — email follow-up | gmail |

### waiting on external

- **metz @ UN global compact** — qualtrics survey approach for PRME 2026 — since 24 apr (4 days; tomorrow's PRME hold is the escalation moment)
- **meredith (PRME)** — facilitation guide timeline — since 21 apr (6 days)
- **IDB Salvador** — evaluation committee reviewing apr 10 documentation; nadia.nochez confirmed receipt 24 apr — passive monitor
- **amna at 10** — jonelle + walaa, proposal sent 26 mar (32 days, overdue for follow-up)
- **KiwiCo international partnerships** — inquiry forwarded 17 apr — passive
- **paul ramchandani (pedal conference)** — proposal sent over the holiday — no response
- **CPA (aakib qureshi)** — new taxdome message landed today; reply pending

### environment handoffs

**Cowork → Claude Code:**
- **vercel harbour-apps preview failures** — repeated since apr 24, two more today; investigate or retire the vercel project now that traffic is on CF workers.
- **PPCS launch tool prod verification** — automated smoke probe to `windedvertigo.com/tools/ppcs-launch/` returns 403 (allowlist), so a manual verify or smoke-allowlist whitelist is needed before thursday.
- **CF KV daily put limit** — context-sync / dispatch writes likely tripping the free tier; upgrade or throttle.
- **creaseworks content + refactor** — add notion covers for playdates/packs/collections; apply phase 1 read-time `cover_url` refactor (mirror vault); build body-content inline image sync.
- **CF cleanup** — revoke temp CF API token, delete DNS-only token, close anotheroption CF account.
- **CRM campaign 404** (POST /api/campaigns) — still unresolved since 17 apr; blocking email sends.
- **CMO marketing module** in ops dashboard — spec at `.brain/memory/marketing/claude-code-prompt.md`.
- **resend webhook** — register URL + set `RESEND_WEBHOOK_SECRET` in resend dashboard.

**Claude Code → Cowork:**
- **tue 12pm PRME hold** — escalation moment for survey platform + facilitation guide cadence; need to come in with a recommendation, not a question.
- **health insurance** — confirm benefits in gusto before thu apr 30 (3 days).
- **CPA** — reply to aakib's new taxdome message (today); finish personal extension organizer step 2/4 in taxdome.
- **gusto** — review 1 employee expense (due mon may 4).
- **ADP invoice 719518339** — week ending apr 25; log to notion + pay.
- **QuickBooks** — record PRME $48,285 income + contractor payments (maria $18,330, lamis $1,005) from 20 apr.
- **attio CRM trial** — keep or cancel decision.
- **`wv-invoice-logged` gmail label** — 3 messages still unlabeled.
- **wed celebration prep** — write paragraph on how maria's work has personally inspired you (whirlpool action item).

### mobile bookmarks

- _no new self-DMs in last 24h_ — slack search returned empty.
- whirlpool agenda + recording for today's session: notion.so/34fe4ee74ba48019a809c50a4eba95ee — action items already logged in TASKS.md.
- gina has declined the wed apr 29 UC-riverside PD panel invite (the cross-calendar joint event); the panel itself still stands at 9am-12pm PT for garrett.
- maria added a **"dry run PPCS 1a"** event for wed apr 29 13:00-14:00 PT — sandwich it between the UC-riverside panel and post-panel decompression.

---

## history (most recent first)

---

## 2026-04-27 (night) — context-sync: PPCS week in motion, anthropic tier 4 landed, dev-collaboration handbook shipped (Cowork)

**what happened:**
- **whirlpool ran today** — fresh action set logged in TASKS.md: payton ↔ jamie on facilitation guides, each member writes a paragraph on maria for wed celebration, payton leads wed solo (garrett at UC-riverside), team drafts plain-language transformative-theory-of-change substack post, garrett + maria finalised thursday's PPCS session 1 anchor leg.
- **6 commits today on windedvertigo repo:** dev-collaboration handbook (3 commits — `696eb8a` add doc, `ec45c7a` render to /handbook/dev-collaboration, `b7c1108` section 8 IP & promotion when building for prme), site fix `30b5dfc` (static-assets incremental cache, drop R2 binding — likely the wv-site CF workers redeploy that gated the PPCS countdown tool), `dcceee3` safe-tier dep bumps, `0e58ab3` weekly auto-sync.
- **anthropic api tier 4 approved** — sales@mail.anthropic.com confirmed account on Build plan with Tier 4 limits; rate-limit increase request resolved. removed from waiting-on-external.
- **maria added a dry-run PPCS 1a** for wed apr 29 13:00-14:00 PT — slot between the UC-riverside panel and decompression.
- **gina declined** the cross-calendar UC-riverside PD panel invite; garrett still attends solo wed 9am-12pm PT.
- **PPCS launch tool prod verification blocked** — automated smoke probe hit 403 from the workspace allowlist (`X-Proxy-Error: blocked-by-allowlist`); need manual browser check or allowlist whitelist before thursday.
- **vercel harbour-apps preview** — two more preview deployment failures today at 16:04 UTC (continuing the post-CF-migration noise).
- **CPA active again** — aakib qureshi sent a fresh taxdome secure message; reply pending.
- **gusto added a new task** — review 1 employee expense, due mon may 4.
- **tomorrow stacks four meetings 9am-1pm PT**: lamis 9am, randall 10am, maria 11am, PRME hold (meredith + sam) 12pm — natural lock-in moment for survey + facilitation cadence decisions.
- slack DM sent to garrett (U06Q4UN4PKR).

---

## 2026-04-26 (night) — context-sync: PPCS week begins, harbour launch path gated on three small actions (Cowork)

**what happened:**
- **PPCS launch is the week's centre of gravity** — session 1 goes live thursday apr 30; the countdown tool (commit `350c772`) is still queued for a CF workers `wv-site` redeploy; anchor-leg prep with maria locked in for monday 10:30-2pm PT straight after whirlpool.
- **harbour pre-launch path** is now ~6 weeks out and entirely gated by three small user actions (oauth redirect URI, deploy script, slack webhook). all phase 0-5a code complete from yesterday's claude-code session.
- **PRME comms** — metz @ UN GC is the most time-sensitive external thread; survey platform decision needed before kick-off comms go out.
- **vercel harbour-apps** continued to fail overnight; project should likely be retired now that traffic is on workers.
- **cash $28,208** — strongest position since formation; PRME revenue recognised cleanly.
- **calendar** — sunday clear; monday: 7am site check, 9am whirlpool, 10:30-2pm PPCS prep with maria; wed apr 29 has UC-Riverside PD panel @ 9am that collides with whirlpool.
- duplicate `### open threads` block in the live state (carried over from prior sync) cleaned up; live block now reflects single source of truth.
- slack DM sent to garrett (U06Q4UN4PKR).

---

## 2026-04-25 (night) — context-sync: infra day complete, vercel failures flagged, PRME programme starting (Cowork)

**what happened:**
- **massive infra day closed out** — CF zone consolidation complete (zone at garrett account `097c92553b268f8360b74f625f6d980a`); site + harbour + depth-chart live on CF workers via opennext; port agent (`wv-claw`) live end-to-end in slack DM. R2 migration complete.
- **vercel production failures** — 4x overnight build failures (port x2, harbour-apps x2 at 5:33am + 6:19am) likely caused by CF domain migration. claude code needed to investigate.
- **CF KV free tier exceeded** — daily 1,000 put limit hit 12:31am apr 25; context-sync or dispatch writes likely culprit.
- **cash at $28,208** — strongest position since formation (+$26,136 since apr 1); PRME revenue landing well.
- **IDB Salvador resolved** — nadia.nochez confirmed receipt of apr 10 documentation; evaluation committee reviewing.
- **PRME programme start** — sam thompson + metz (UN GC) asked about feedback survey/qualtrics expiry apr 24; garrett replied. metz follow-up still unread.
- **ADP invoice** — week ending apr 25 arrived; needs payment.
- **health insurance deadline approaching** — gusto april 30 (5 days).
- **google security alert** — new sign-in on mac flagged overnight (likely legitimate post-migration session).
- tomorrow (sun apr 26): calendar clear — recovery day.
- slack DM sent to garrett (U06Q4UN4PKR).

---

## 2026-04-25 — full-day infra push: CF zone consolidation finished, site + harbour + depth-chart on workers, port agent live, R2 image migration (Claude Code)

**what happened (~14 hour session):**

**infrastructure shipped:**
- **CF zone consolidation finished** at 2026-04-25T01:43 UTC — windedvertigo.com zone now lives at the garrett account (`097c92553b268f8360b74f625f6d980a`).
- **site → CF Workers**: windedvertigo.com migrated vercel → workers (`wv-site` via opennext). Vercel project `windedvertigo-site` deleted.
- **harbour → CF Workers**: migrated to `wv-harbour-harbour`; notion client v2 → v5 upgrade.
- **depth-chart fully provisioned on workers**: own CF routes (bypasses site router); auth flow works end-to-end; SSO via shared `.windedvertigo.com` cookie verified.
- **port agent (`wv-claw`) deployed end-to-end** — `@wv-claw what campaigns are active?` works in slack DM.
- **nordic.windedvertigo.com** custom domain attached to existing vercel project.
- **R2 image migration completed** across vault, harbour, creaseworks (creds repair), site.

**key fixes:**
- **vault cover image bucket access restored** after CF account migration: re-enabled `r2.dev` public access, updated `R2_PUBLIC_URL`, rewrote 72 DB rows via `fix-cover-urls.mjs` migration script. Vault refactored to compute `cover_url` from `cover_r2_key` at query time.
- **harbour tile sync** via admin endpoint `POST /harbour/api/admin/sync-tiles` (16 from notion + 3 fallback to repo statics).
- **creaseworks R2 access keys** synced from vault — was stuck on stale anotheroption keys, sync silently failed.
- **auth.js v5 redirects on workers**: fixed via `WORKERS_AUTH_PAGES_BASEPATH` env var on depth-chart, prefixes `pages.error` / `signIn` paths.

**known incomplete:** creaseworks notion sync runs but `cover_url` still NULL because notion source pages have no covers (content work pending).

**pending for next session:**
- add cover images in notion for creaseworks playdates/packs/collections
- apply phase 1 refactor to creaseworks (decouple cover_url from R2 URL hash, mirror vault pattern)
- body-content image sync (parse body_html for inline notion images)
- revoke temporary CF API token; delete DNS-only token; close anotheroption account

migration record: `~/.claude/plans/partitioned-painting-pascal.md`. infrastructure state table in `CLAUDE.md` already updated.

---

## 2026-04-24 (night) — context-sync: IDB receipt confirmed, cloudflare consolidation done, harbour → workers migration, port still failing (Cowork)

**what happened:**
- **IDB Salvador UNBLOCKED** — nadia.nochez@mined.gob.sv confirmed receipt of the apr 10 documentation (10:38pm apr 24); evaluation committee actively reviewing. 14-day silence resolved — no action needed until outcome.
- **cloudflare account consolidation**: windedvertigo.com zone successfully moved to `garrett@windedvertigo.com` account (cloudflare confirmation emails at 1:42am + 1:44am apr 25). R2 buckets, workers, KV/D1 bindings still need verification under new account.
- **harbour → cloudflare workers migration**: 4 commits today — opennext migration, worker routes for windedvertigo.com, portfolio assets routes (systems-thinking + values-auction), `/do` page fallback fix. significant infrastructure shift.
- **cloudflare workers KV free tier exceeded**: daily 1,000 put limit hit (alert received 12:31am apr 25). context-sync or dispatch writes are the likely culprit — need upgrade or throttling.
- **port deployment failures**: 6+ vercel failures across apr 24; 1 more at 2am apr 25. urgent claude code task.
- **PRME programme comms active**: sam thompson (UN GC) asked about feedback survey + follow-up email comms; garrett replied same day. alex brewer sent discussion post formatting notes; garrett forwarded to maria.
- **harbour/portfolio placement question**: garrett asked maria whether her games should live in harbour vs portfolio — awaiting her input.
- **gusto**: payton jaeger's bank account details updated (routine notification, no action needed).
- tomorrow (sat apr 25): terbinafine repeat LFT calendar reminder, NFL draft rounds 4-7 (9am-2pm). no work meetings.
- slack DM sent to garrett (U06Q4UN4PKR).

---

## 2026-04-23 (night) — context-sync: harbour build failing, vercel account merge started, CPA escalating, health insurance deadline, supabase added (Cowork)

**what happened:**
- **harbour production deployment broken** — two failed builds at 1am apr 24 (emails from notifications@vercel.com). likely caused by three-intelligence-workbook PR (#4) or the vercel account consolidation now in progress. claude code needed urgently.
- **vercel account consolidation started** — `anotheroption@gmail.com` sent two vercel team invites to `garrett@windedvertigo.com` (12:40am + 12:44am apr 24): "ghandoff's projects" + "winded vertigo" teams. this is the TASKS.md consolidation work beginning. R2 / KV / workers bindings need verification.
- **engineering**: 1 commit — `9ba44ee feat(site): add three-intelligence-workbook at /harbour/three-intelligence-workbook (#4)` — new harbour tool live (or attempting to be).
- **CPA escalating**: abhishek sachdeva (2 messages) + aakib qureshi (2 messages) sent new taxdome secure messages on apr 23. now 4 unread messages in the portal — tax work is actively blocked on garrett's response.
- **health insurance**: gusto email flagged june 1 coverage deadline is **april 30** (7 days) — unactioned.
- **supabase added to stack**: welcome email arrived apr 23; garrett is onboarding maria to the engineering stack (github email + apps developed — stack migration in progress).
- **PRME**: maria resolved 4 suggestions on ppcs-2026-session-1a this morning. PPCS anchor prep meeting set for mon apr 27.
- **cash**: $3,924 (morning briefing). chase ink CC payment was due today — status unconfirmed.
- **save the children**: draft consultancy application spotted in gmail (climate resilience CCCRM) — unclear if garrett or maria started it; needs triage.
- **tomorrow (apr 24)**: laton appt (10:50am), R&D meeting with gina (11am), NFL draft rounds 2-3 (4pm).
- slack DM sent to garrett (U06Q4UN4PKR).

---

## 2026-04-22 (night) — context-sync: facilitation guide in production, nordic doc landed, press play tiers set, CRM 404 bug flagged (Cowork)

**what happened:**
- **PRME facilitation guides**: maria made active suggestions in ppcs-2026-session-1a-facilitation-guide.docx (8:26am). production underway. meredith's timeline response still outstanding (32h).
- **nordic naturals**: connect call with lauren bosio happened today (3pm). post-call, lauren shared "standardisations of substantiation data" google doc at 5:55pm — review + comments needed.
- **press play whirlpool** (apr 22): service tiers defined (playful injection as entry point), pedal conference (paul ramchandani) identified as primary target. payton leading co-branded landing page + first campaign draft for may 11.
- **engineering**: 2 commits — the-mashup whirlpool facilitation tool + clean URL redirects shipped.
- **CMO dispatch flagged**: CRM campaign 404 bug (POST /api/campaigns, payton reported apr 17) blocking all email sends — claude code urgent. harbour whisper campaign behind: 9 days to may 1, no teasers live yet.
- **cash confirmed**: $5,076 ($3,500 owner draw; operating burn -$496 MTD).
- **anthropic ZDR request** filed at 3:22am apr 23 to support@anthropic.com re: production API key.
- CPA TaxDome (fifth+ reminder) still unactioned. IDB MINEDUCYT receipt at 12 days — escalate with maria.
- tomorrow (thu apr 23): garrett × maria weekly (9am), personal appointment (12:30pm), NFL draft r1 (5pm w/ gina). chase CC payment due.
- slack DM sent to garrett (U06Q4UN4PKR).

---

## 2026-04-21 (night) — context-sync: PRME facilitation guide urgency, writing retreat underway, wire sent (Cowork)

**what happened:**
- **PRME urgency**: meredith's team requested facilitation guides by tue apr 22 (tomorrow). maria flagged this is the final webinar development phase. garrett proposed to meredith: preview tuesday + full guides thursday. awaiting response.
- writing retreat happened today — payton accepted garrett's suggestion in "first fold: seven drafts from unfolding v3". Substack piece on "play, aliveness, justice" taking shape.
- chase wire transfer confirmation received this morning — wire sent (likely second lamis payment or PRME-related).
- gina jaeger (nordic naturals) shared "WindedVertigoMaterials" dropbox folder with garrett — new collaboration asset for nordic naturals work.
- playdate intake flow tested: garrett self-booked a "general" playdate — form is working.
- carly ciarrocchi reference request via Happily freelancer platform landed — unactioned.
- CPA: fifth TaxDome reminder (tax extension organiser + missing docs) — remains unactioned.
- no git commits today — engineering quiet.
- tomorrow (wed apr 22): m&m&g (8:30am), whirlpool x press play (9am), payton sync (10am), fruitstand (11am), nordic naturals zoom with lauren (3pm).
- slack DM sent to garrett (U06Q4UN4PKR).

---

## 2026-04-20 (night) — context-sync: PRME payment received, API credits resolved, rubric-co-builder live (Cowork)

**what happened:**
- **PRME payment landed** — garrett confirmed to lamis via slack DM at ~6pm PT: "$1000 wired, more at month end." removes the longest-running external blocker (24 days outstanding).
- claude API credits topped up — anthropic receipt #2389-1698-5975 arrived; individual org outage from yesterday resolved.
- 7 commits today: dep bumps (notionhq/client v5, typescript 5→6, @types/node 22→25, resend 6.12.1, protobufjs security fix, ancestry deps aligned) + `feat(site): proxy /harbour/rubric-co-builder` — new tool live on site.
- new lead: maria applied to childfund américas consulting opportunity (solicitud de TDR), CC'd garrett.
- carly ciarrocchi replied to garrett's email — enthusiastic, asking about TED x LEGO playday NYC may.
- anthropic rate limit increase requested — added to queue, no timeline.
- miro renewal charged (receipt #2722-9307) — needs check at next stack audit.
- CPA: fourth TaxDome reminder still unactioned — remains #1 urgent admin item.
- tomorrow stacked: strategy playdates (8am), lamis (9am), maria (10am), PRME hold (12pm), leah (3:30pm).
- slack DM sent to garrett (U06Q4UN4PKR).

---

## 2026-04-19 (night) — context-sync: writer's room shipped, claude API credits depleted (Cowork)

**what happened:**
- 5 git commits today: writer's room whirlpool tool live at `/tools/` on the site, ancestry auth.js sign-in fallback link, next-env.d.ts regenerated after production build, brain memory updated.
- new urgent item: claude API credits depleted for garrett's individual org — action-needed email arrived apr 20 ~4am UTC. individual API access disabled until credits topped up.
- CPA: third TaxDome reminder for 2025 individual tax extension organiser landed apr 20 morning — still unactioned.
- PRME: payment now 23 days outstanding. "winded.vertigo & PRME" meeting confirmed on calendar for tue apr 21 12pm PT — key escalation moment.
- tomorrow's calendar: site check (7am), whirlpool (9am). tuesday stacked: strategy playdates (8am), lamis (9am), maria (10am), PRME hold (12pm), leah (3:30pm — new meeting added apr 18).
- notion: only world bank procurement alerts in last 24h — no project status changes.
- slack DM to garrett could not be sent — slack MCP tools not available in this session (recurring limitation).

---

## 2026-04-18 (night) — context-sync: second pass, state confirmed stable (Cowork)

**what happened:**
- second context-sync pass of the day — no material changes since 9pm run. no git commits, no new actionable emails beyond earlier TaxDome + KiwiCo.
- sunday calendar is empty. monday: weekly site check (7am), whirlpool (9am). tuesday stacked: strategy playdates (8am), lamis (9am), maria (10am), PRME hold (12pm), leah (3:30pm).
- notion: only World Bank procurement alerts in last 24h — no project status changes.
- gmail: TaxDome missing docs reminder (still unactioned), KiwiCo satisfaction survey (noise), ADP quarterly statement available.
- slack DM to garrett could not be sent — slack MCP tools not available in this session (recurring limitation).
- handoff live state refreshed and confirmed accurate.

---

## 2026-04-18 (evening) — context-sync: CPA reminders escalating, KiwiCo lead, quiet weekend (Cowork)

**what happened:**
- quiet weekend day — no git commits in last 48h.
- CPA tax situation escalating: two fresh TaxDome reminders landed (missing documents for tax return + 2025 individual tax extension organiser). this is now the #1 urgent item.
- KiwiCo replied to winded.vertigo partnership outreach (apr 17) — forwarded inquiry to their international partnerships team. genuine new lead to monitor.
- ADP quarterly retirement plan statement now available online.
- Torrance Festival of Ideas: CREATIVITY & AI — whova profile validation email received (apr 17).
- PRME payment now 22 days outstanding (was 20). tue PRME hold meeting with meredith is the escalation moment.
- Amna at 10 follow-up now 23 days overdue.
- IDB Salvador now 8 days past deadline.
- monday calendar: weekly site check (7am), whirlpool (9am). tuesday stacked: strategy playdates (8am), lamis (9am), maria (10am), PRME hold (12pm), leah (3:30pm).
- slack DM to garrett could not be sent — slack MCP tools not available in this session.

---

## 2026-04-16 (evening) — context-sync: nordic meeting done, PCS gap analysis shipped, invoice processor broken (Cowork)

**what happened:**
- nordic naturals meeting with lauren bosio completed (3:15pm). PCS gap analysis finished — 4 critical gaps, 4 important gaps, 4-phase roadmap. follow-up booked **wed apr 22 3pm**. lauren sent PCS template by email. project moved from "scoping" to active delivery.
- 11 git commits: website feedback improvements (phases 1–4), playdate intake form replacing external booking, systems-thinking simulator overhaul (reactive canvas, dark theme, burnout map), security fixes (4 npm vulns), monorepo dependency alignment.
- invoice processor dispatch broken — gmail MCP stale definitions + notion invoice tracker DB not found in search. needs cowork session reload.
- garrett discussed full-stack tooling access with maria (upstash, MCP integrations, notion brief for tech stack understanding).
- michael renvillard replied to website feedback email — gracious close, offered further help.
- cash: $5,076.19 ($3,500 owner contribution offset by -$496 operating MTD).

---

## 2026-04-15 (evening) — context-sync: whirlpool pivot, nordic call tomorrow, CPA urgent (Cowork)

**what happened:**
- whirlpool session produced harbour strategy pivot: depth over breadth (pilot 2–4 games per category), play therapists as beachhead audience. writing retreat booked mon apr 21.
- lauren bosio (nordic naturals) confirmed working call for thu apr 16 at 3pm PT — first real session since SOW approval.
- CPA: 3 unread emails from straight talk CPAs — tax extension organizer reminder, missing docs request, vivek ghelani secure chat. needs immediate attention.
- CMO weekly review flagged 21-day social silence; harbour phase 1 whisper campaign behind schedule for may 1 launch.
- git: 3 commits on systems-thinking simulator (lakeshore sync, dosage sliders, stacked trade-off charts).
- stripe unrecognised device sign-in alert — needs verification.
- invoice sweep: all quiet, nothing new logged.

---

## 2026-04-15 — engagement tracking shipped + email-draft backfill (Claude Code)

**what happened:**
- **Engagement tracking deployed** (commit 2bbeddd, deployed to production apr 15):
  - Engagement profile on org pages — shows email activity (sends, opens, clicks), campaign history, and engagement score per organisation.
  - Recipient transparency — email drafts now track `sentTo` (email address) and `contactId` (when sent to a contact vs org-level email).
  - Resend webhook activity logging — incoming webhook events (delivered, opened, clicked, bounced, complained) are logged and update draft metrics in real time.
  - UTM attribution — outbound email links are tagged with utm_source/medium/campaign/content for click-through tracking.
  - Campaign recipients page — view all recipients for a campaign with per-recipient open/click stats.
- **Backfill script created** (`port/app/api/admin/backfill-email-drafts/route.ts`): one-shot GET endpoint to populate `sentTo` on existing email drafts from the first campaign (`33be4ee7-4ba4-81be-b832-d045290c5a30`). Fetches org email for each draft that has an `organizationId` but empty `sentTo`, writes it back with 350ms rate-limit delay.
- Memory: updated handoff live state, cleaned up port rename thread.

---

## 2026-04-14 (evening) — context-sync: nordic SOW approved, port rename shipped, PRME inbound (Cowork)

**what happened:**
- nordic naturals SOW approved (garrett told payton via slack DM). contract signing expected this week or next — moves from "scoping" to "closing" in pipeline.
- crm/ → port/ monorepo rename shipped (3 commits: bf7bea7 refactor rename, bd66fba vercel.json fix, 5102e9b .vercelignore fix).
- garrett rescheduled maria sync from tue to wed after 1:30pm her time.
- payton forwarded an inbound from isabel rodríguez tejedo (universidad de navarra) re: "certificate of excellence" — likely PPCS/PRME-adjacent, needs triage.
- siyavula MEL and sesame workshop threads appear dormant — removed from open threads (siyavula soft pass, sesame received pass).
- gmail: only 2 unread (payton's fwd + notion 3.4 newsletter). no urgent external replies.
- no unresolved self-DMs in slack.

---

## 2026-04-14 — port restructure shipped + follow-on tasks (Claude Code)

**what happened:**
- **Port restructure complete** (commit d0eec54, deployed to production): sidebar 12→7, dashboard with pipeline kanban, merged pages (opportunities, projects, campaigns), audience filters simplified 7→4 (fit, relationship, source, segment), derived priority system (fit × relationship matrix), skeleton fallbacks, URL-synced tabs, staggered kanban animations. All old URLs preserved via 308 redirects.
- **Follow-on tasks shipped same session:**
  - Notion schema: added native "relationship" select property to organizations database (7 stages: stranger→champion), backfill script created, mapper updated to prefer native value with derivation fallback
  - Mobile tab bar: updated 5 tabs (pipeline, contacts, log, today, work), redirect → /m/pipeline
  - Dead code cleanup: deleted status-badge.tsx, org-edit-dialog.tsx; removed PriorityBadge from priority-badge.tsx (FitBadge kept)
  - Memory: fixed crm→port references in operational.md, added project row
- **Key architecture decision:** relationship is now a first-class Notion property. On create/update, the app computes relationship from connection/outreach/friendship and writes it. On read, it prefers the native value but falls back to derivation for any un-backfilled rows.

---

## 2026-04-13 (evening) — context-sync: nordic naturals engagement surface appeared (Cowork)

**what happened:**
- sharon matheny (nordic naturals) had lauren bosio grant garrett viewer access to three smartsheet workspaces: CAIPB Database, AI Details for Qualified RMs, CAIPB Database — MASTER DATA. framed as "insights" request — scope + cadence not yet defined.
- garrett shared SQR-RCT x PCS platform credentials with sharon + gina via slack group DM (nordic naturals workspace).
- tax extension organizer reminder from straight talk CPAs landed overnight — needs completion alongside the Q1 CFO review booking.
- whirlpool "the world prowl" was play-only; no business agenda; apr 8 press play actions remain the live list for wed apr 15.
- git: only housekeeping commits on windedvertigo repo (submodule / gitignore tidy).
- tomorrow's hot window: PRME bi-weekly at 12pm PT — natural moment to raise invoice payment and meredith's comms reset note from apr 7.

---

## 2026-04-13 — context-sync: first live-state refresh (Cowork)

**what happened:**
- first context-sync run — live state block fully populated from Gmail, Slack, git, Notion, and TASKS.md
- IDB Salvador: Maria submitted documentation on apr 10 (deadline met) — receipt confirmation still needed from MINEDUCYT
- Siyavula MEL proposal received a soft pass (prefers SA-based orgs) — Garrett replied
- ancestry app: significant Claude Code build activity this week (photo gallery, GEDCOM 7.0 export, AI research assistant, DNA/ethnicity, census timeline, collaborative comments, mobile redesign, merge wizard)
- PRME survey showing 94 responses; Meredith sent comms reset note apr 7
- CPA Q1 CFO review request from Abhishek — needs booking

---

## 2026-03-29 — ops dashboard redesigned, KV + Notion wired, auto-deploy enabled (Claude Code)

**What happened:**
- **Dashboard redesign:** Complete UX overhaul — financial strip at top with hero cash number, computed runway bar, auto-derived alerts (low runway, deadline countdown, blocked projects). Two-column layout: actions + projects (left), schedule + dispatch (right). Interactive task checkboxes with localStorage persistence. Collapsible sections. Expandable project rows.
- **Cloudflare KV integration:** All 6 API routes now try KV first (`ops:finance`, `ops:projects`, etc.), fall back to static data. KV read/write utilities in `ops/lib/kv.ts`.
- **KV write endpoint:** `POST /api/kv` accepts `{ key, data }` with bearer token auth (`KV_WRITE_TOKEN`). This is how Cowork dispatch tasks push data.
- **Notion integration:** `ops/lib/notion/projects.ts` fetches projects from the shared Notion projects DB. Falls back to static data if Notion unavailable. `page.tsx` calls `fetchProjects()` server-side.
- **GitHub auto-deploy:** wv-ops Vercel project connected to `ghandoff/windedvertigo` monorepo with `rootDirectory: ops` and `sourceFilesOutsideRootDirectory: true`. Pushes to main auto-deploy.

**Env vars needed on Vercel (not yet set):**
- `CLOUDFLARE_ACCOUNT_ID` — Cloudflare account ID
- `CLOUDFLARE_API_TOKEN` — Cloudflare API token with KV read access
- `KV_WRITE_TOKEN` — arbitrary secret for the POST /api/kv endpoint
- `NOTION_TOKEN` — Notion integration token (same one CRM uses)

**How Cowork dispatch should push data:**
```bash
curl -X POST https://ops.windedvertigo.com/api/kv \
  -H "Authorization: Bearer $KV_WRITE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"key":"ops:finance","data":[...]}'
```
Keys: `ops:finance`, `ops:projects`, `ops:team`, `ops:calendar`, `ops:tasks`, `ops:dispatch`

**What needs doing next:**
- [ ] Set env vars on Vercel (CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_API_TOKEN, KV_WRITE_TOKEN, NOTION_TOKEN)
- [ ] Build Cowork dispatch task to push dashboard snapshots to KV after weekly-cfo-review
- [ ] Resolve Notion project lead person IDs → names (owner field currently undefined for Notion-sourced projects)

---

## 2026-03-28 — ops auth fixed, hardened, design system integrated (Claude Code)

**What happened:**
- **Auth fix (critical):** Root cause — `page.tsx` was a `'use client'` static component. Next.js prerendered it at build time (`○`). On Vercel, static pages bypass middleware entirely (served from CDN). The middleware was correct but never ran. Fixed by converting to server component calling `auth()` → forces dynamic rendering (`ƒ`) → middleware now executes.
- Added sign-out button + user email display in header
- Made header date dynamic (was hardcoded "mar 28")
- Imported `@windedvertigo/tokens/index.css` — shared brand palette, semantic colors, spacing, typography, accessibility primitives
- Replaced all hardcoded hex colors with ops-specific CSS custom properties via `@theme inline`
- Removed unnecessary `'use client'` from 7 presentational components (now server components, smaller JS bundle)
- Simplified `tailwind.config.ts` — moved colors to CSS-native `@theme` block (Tailwind v4 pattern)
- Created 6 API routes: `/api/finance`, `/api/projects`, `/api/team`, `/api/calendar`, `/api/tasks`, `/api/dispatch`
- Extracted TypeScript interfaces to `lib/types.ts` (shared by components + API routes)

**What's deployed:**
- Auth-protected dashboard at ops.windedvertigo.com — redirects to /login if no session
- Google SSO with @windedvertigo.com domain restriction + ALLOWED_EMAILS allowlist
- Sign-out button + user email in header
- Dynamic date in header
- 6 API endpoints returning static data (ready for live data integration)
- Shared design tokens from `@windedvertigo/tokens`

**Middleware deprecation note:**
Next.js 16 warns `middleware.ts` is deprecated in favor of `proxy.ts`. The middleware still works for dynamic routes. CRM uses the same pattern. Not migrating yet — `proxy` convention is too new and the CRM would need to migrate simultaneously.

**Data layer architecture recommendation:**

The ops dashboard needs live data from QuickBooks, Gusto, Notion, and Google Calendar. The ops Next.js app should NOT hold OAuth tokens for these services — that's Cowork's job via MCPs.

**Recommended: Cowork dispatch → Cloudflare KV → Ops reads**

1. Cowork dispatch tasks (weekly-cfo-review, invoice-processor, etc.) already run on schedule with MCP access to QuickBooks, Gusto, Notion, GCal.
2. After each run, dispatch pushes a pre-computed "dashboard snapshot" JSON blob to Cloudflare KV (one key per data domain: `ops:finance`, `ops:projects`, `ops:team`, etc.).
3. Ops API routes read from KV at request time (sub-10ms). If KV key is empty/missing, return the static fallback from `lib/data.ts`.
4. Optional: a manual "refresh" button in the dashboard triggers an on-demand KV update via a dispatch task.

**Why this approach:**
- Cowork already has the MCPs and runs on schedule — no new auth tokens needed
- KV reads are fast and cheap — dashboard stays snappy
- Data freshness matches business cadence (daily invoices, weekly CFO review)
- Ops never needs direct access to QuickBooks/Gusto APIs
- Static fallback means the dashboard always renders even if KV is empty

**What needs doing next:**
- [x] ~~Verify OAuth flow~~ — confirmed working in incognito (2026-03-28)
- [x] ~~Set up Cloudflare KV namespace~~ — `wv-ops-data` created (id: d740788337354d738e1be321d2c4b277)
- [ ] Build Cowork dispatch task to push dashboard snapshot to KV after weekly-cfo-review
- [ ] Update API routes to read from KV with static fallback
- [ ] Connect wv-ops Vercel project to GitHub for auto-deploy on push
- [ ] **Cash position alert**: $2,072 cash with ~$4,275/mo burn. PRME invoice outstanding — revenue needs to land.

**Brand alignment (2026-03-28):**
- Login: cadet bg, champagne text, branded SSO button
- Header: shared .wv-header chrome from tokens
- Footer: shared .wv-footer chrome
- Surface colors: cadet-derived darks (not generic grays)
- Section dividers: redwood gradient accent
- Financial data: live from QuickBooks + Gusto

---

## 2026-03-28 — ops dashboard deployed (Cowork → Claude Code)

**What happened:**
- Built ops command center as new monorepo workspace (`ops/`)
- Configured Vercel project `wv-ops` with custom domain `ops.windedvertigo.com`
- Set up Auth.js v5 Google OAuth (shared with CRM)
- Cloudflare DNS CNAME added for ops subdomain
- Three deploys to fix build issues:
  1. First deploy failed: PostCSS config used Tailwind v3 syntax (`tailwindcss` as plugin)
  2. Second deploy failed: `globals.css` used `@tailwind` directives + `@apply` — Tailwind v4 needs `@import "tailwindcss"` and chokes on `@apply` with certain utility classes
  3. Third deploy succeeded after converting to plain CSS values

**What's deployed:**
- Login page with Google SSO button at ops.windedvertigo.com
- Dashboard shell with placeholder "awaiting data" cards
- Edge middleware checking session cookie for auth

**What needs doing next (Claude Code):**
- [ ] Verify Google OAuth flow works end-to-end (Garrett needs to test in browser)
- [ ] Address Next.js 16 middleware deprecation warning (`middleware.ts` → `proxy.ts`)
- [ ] Wire QuickBooks data into financial dashboard cards (API routes)
- [ ] Wire Gusto payroll data into team/payroll cards (API routes)
- [ ] Connect Vercel project to GitHub repo for auto-deploy on push
- [ ] Consider: should ops share Auth.js config with CRM via `packages/auth`?

**Key files:**
- `ops/lib/auth.ts` — Auth.js v5 config
- `ops/middleware.ts` — edge auth (deprecated convention, works for now)
- `ops/app/globals.css` — Tailwind v4 with `@import "tailwindcss"`
- `ops/postcss.config.mjs` — uses `@tailwindcss/postcss`
- `scripts/deploy-ops.sh` — Vercel deploy script

**Vercel env vars (set in dashboard, not in repo):**
- GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, AUTH_SECRET, AUTH_TRUST_HOST, AUTH_URL, ALLOWED_EMAILS

**Commits:**
- `5da6b98` — feat(ops): add ops command center as monorepo workspace
- `f4db54e` — fix(ops): use @tailwindcss/postcss for Tailwind v4
- `37d14a2` — fix(ops): use Tailwind v4 CSS import and remove @apply directives
