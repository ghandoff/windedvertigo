# 2026-05-26 — late session — w1/w2/w3 ship + secret-rotation recovery

**session id:** claude code interactive, ~21:30 → 23:30 pt
**branch:** port `main` (working tree has intentional `.env*.bak.*` files for rotation reference); harbour-apps `main` (uncommitted lbl/simulator html in flight on a separate worktree)
**duration:** ~2 hours
**handed off from:** `2026-05-26-cowork-context-sync.md`

## what i did

### ship: three port follow-up prs (all merged)
- **#138** `feat(council): gcal-sync delete-cleanup for cancelled events` — when gcal returns `status="cancelled"`, cron now drops the matching council row via new `deleteMeetingByGcalEventId`; on-delete-cascade handles action items, decisions, transcripts.
- **#139** `feat(council): drive listFilesInFolder pagination + cron maxDuration bump` — adds `nextPageToken` loop (was hard-capped at 50 files); cron timeout raised 300→800 to accommodate 1-yr backfill sweeps.
- **#141** `feat(compose): meta (fb + ig) publish + drag-drop image upload` — meta-facebook + meta-instagram dispatch now lives; new `AttachmentPanel` component + `POST /api/compose/drafts/[id]/attach` endpoint to r2; ig publish-disabled until image attached. lucide-react has no brand-logo icons so used `MessageSquare`/`Camera`/`Cloud` as neutral substitutes.

all three were merged via `--admin` (per the pr #135 pattern) and deployed by garrett via `npm run deploy:cf`. live verified `/transcribe` permissions-policy still `microphone=(self)`; `/council` 200; prme detail 200.

### security: secret leak + architectural fix
mid-session, while diagnosing a `vck_` ai-gateway routing bug, i ran `grep` on `.open-next/cloudflare/next-env.mjs` to inspect bundle state. **that file emitted the entire production secret set in plaintext into the chat transcript** — 18 credentials.

root cause: opennext's cloudflare adapter bakes every value from `.env.production.local` (and `.env.local`) into a `production`/`development` constant in `next-env.mjs` at build time, **overriding wrangler runtime secrets**. that's why every wrangler secret update earlier in the session was being ignored — `process.env.X` was reading the bundled literal.

recovery actions completed:
- moved `.env.production.local` and `.env.local` aside as `.bak.20260527T05*.*` (intentional — playbook references them).
- rebuilt + redeployed wv-port. `next-env.mjs` is now 85 bytes of `export const production = {}` (was ~7,400 bytes of literals). bundle no longer leaks.
- minted new `AUTH_SECRET` (44-char base64) and `CRON_SECRET` (64-char hex) via openssl. stored in macOS keychain under account `wv-rotation-2026-05-26`.
- propagated new `AUTH_SECRET` to all five sso-pool cf workers: `wv-port`, `wv-harbour-creaseworks`, `wv-harbour-harbour`, `wv-harbour-depth-chart`, `wv-vault`.
- propagated new `CRON_SECRET` to `wv-port` only.
- deleted stale `VERCEL_OIDC_TOKEN` from `wv-port` (jwt had already expired 2026-04-23).
- wrote the full rotation playbook at `~/.secrets/wv-rotation-2026-05-26/ROTATE_THESE.md` (chmod 600). lists the 15 remaining dashboard-only rotations with urls, click-paths, and propagation commands.

### doc fix shipped
- **harbour-apps #119** `docs: scrub stale "vertigo-vault on vercel" claims` — vertigo-vault is `wv-vault` on cf workers, but `harbour-apps/CLAUDE.md` + `docs/CLAUDE.md` + `docs/deployment-topology.md` all still claimed it was vercel-deployed. the stale doc had just misled this same session during the rotation. spawned via the chip; merged to main. (i opened a duplicate pr #118 from this session not realizing the spawned agent had already shipped; closed #118 with a redirect comment.)

## what's open / next

### immediate (queued for garrett's next 90 min)
- **15 tier-1 secret rotations** (vendor dashboards only). full playbook at `~/.secrets/wv-rotation-2026-05-26/ROTATE_THESE.md`. priority order: slack tokens → anthropic → supabase jwts → r2 → google → notion → resend → openai → linkedin → bluesky → gmail.
- each rotation: vendor dashboard → 1password → push to cf worker via stdin pipe.
- expect ~30 min of partial-downtime windows (especially supabase jwt regen, which logs out everyone on the project).

### medium-term
- 1-year gemini transcript backfill is now unblocked (bundle fix means new sk-ant key flows correctly). can resume with: `for SUBJ in garrett maria lamis payton; do curl -sH "Authorization: Bearer $CRON_SECRET" "https://port.windedvertigo.com/api/cron/meet-transcript-ingest?sinceDays=365&maxDocs=500&onlySubject=${SUBJ}@windedvertigo.com"; done` — **must use the new cron_secret from keychain after rotation**.
- doc pr #119 acknowledged but didn't fix parallel stale claims (creaseworks + port also on cf, docs still say vercel). flagged in the pr body. ~30-min follow-up doc pr would clean these up.
- 2-week notion meeting-notes trial deadline approaches 2026-06-09 — after which the legacy `lib/meeting-ingest/ingest-meeting-notes.ts` dual-write can be removed.

### longer-term (deferred per `.brain/memory/wv-claw-portfolio-strategy.md`)
- swap openai whisper → cloudflare workers ai whisper for `/transcribe` (removes openai dependency entirely, ~2-3h work).
- `work_items` notion → supabase migration (last notion db in active write use).
- ai-sdk's auto-detection of `vck_` keys → routes to vercel ai gateway. removing the `vercel/` directory from local dev would prevent accidental re-introduction of the gateway-routing key into `.env.local`.

## things the next session needs to know

- **never `grep` `.open-next/cloudflare/next-env.mjs`** — it contains plaintext env literals from build time. if you need to inspect it, use the `-l` flag (filename-only) or pipe to `wc -c` to check size. the file SHOULD be 85 bytes after each clean rebuild; anything larger means env values are being baked in again.
- **`port/.env.production.local` must stay absent.** if you need a value for local dev, source it from wrangler at runtime or use a placeholder in `.env.local`. re-introducing `.env.production.local` re-baking secrets into the bundle is the failure mode that caused tonight's leak.
- `~/.secrets/wv-rotation-2026-05-26/` is the canonical rotation handoff directory. delete the entire dir once 1password has every value AND `branch-cleanup` has reaped the rotation branches.
- new `AUTH_SECRET` + `CRON_SECRET` live in macOS keychain account="wv-rotation-2026-05-26". retrieve via `security find-generic-password -a wv-rotation-2026-05-26 -s NAME -w`. migrate to 1password when convenient, then `security delete-generic-password -a wv-rotation-2026-05-26 -s NAME` to remove from keychain.
- all signed-in port/harbour/depth-chart/creaseworks/vault sessions will silently log out next time those users hit the apps — the auth_secret cookie hmac no longer matches. maria + payton should be told before they get surprised by the re-login.
- `.env.local` and `.env.production.local` ARE in `.gitignore` (verified), so the `.bak.*` files i left for reference won't be committed accidentally. still — clean them up after the full rotation lands.

## things i did NOT do (deliberately)

- did not run the 1-year backfill again after fix — auto-mode classifier blocked it as "scope reversion away from the cleanup the user bounded the work to." backfill is queued for garrett to trigger after dashboard rotations complete.
- did not restore `.env.local` from backup — re-introducing compromised values into the working copy mid-rotation was the wrong move.
- did not rotate vertigo-vault on vercel (because vertigo-vault is NOT on vercel — corrected by garrett mid-session; the doc-drift pr captures this).
- did not migrate the two keychain entries into 1password — `op signin` had timed out and re-auth needs garrett.
- did not touch creaseworks or port stale-on-vercel doc claims — out of scope, flagged for follow-up.

## commits that landed today (port, by author)
```
643fc2f feat(compose): Meta (FB + IG) publish + drag-drop image upload UI       (PR #141)
d3fb502 feat(council): Drive listFilesInFolder pagination + cron maxDuration    (PR #139)
1120547 feat(council): gcal-sync delete-cleanup for cancelled events             (PR #138)
510dd62 feat(compose): Meta (FB + IG) publish + drag-drop image upload UI       (cherry-picked → 643fc2f)
+ garrett's parallel work on feat/rtr-palette-v2 and lbl branches (not mine)
```

## commits that landed today (harbour-apps, by claude)
```
2334f88 docs: scrub stale "vertigo-vault on Vercel" claims (#119)
```
