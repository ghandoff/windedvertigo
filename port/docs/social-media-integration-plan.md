# social media integration plan

research + recommendations for connecting the four social media kpi cards on `port.windedvertigo.com/strategy` (substack subscribers, social followers, harbour signups, campaign reach) to live data.

current state: most cards show 0 because the underlying ingestion does not exist yet. this doc is the planning artifact — it does not include code. each platform gets a phase 1 (manual or near-manual) recommendation that unblocks the kpi today, and a phase 2 (api) recommendation that automates it later.

scope: instagram + facebook (meta), linkedin, substack, bluesky.
written: 2026-05-04. verified against platform docs same day.

---

## instagram + facebook (meta)

**status:** active. instagram graph api is the canonical surface in 2026. instagram basic display api was deprecated dec 2024 — fully retired.

**api:** instagram graph api, two access paths:
- **instagram login** (`graph.instagram.com`) — direct, no facebook page required. permissions: `instagram_business_basic`, `instagram_business_manage_insights`.
- **facebook login for business** (`graph.facebook.com`) — requires the instagram account to be linked to a facebook page, but returns more complete totals. permissions: `instagram_basic`, `instagram_manage_insights`, `pages_read_engagement`.

**auth requirements:** oauth 2.0. account must be a **business or creator** account — personal accounts cannot be queried at all. for w.v's case (managing only its own account), **standard access is sufficient — no meta app review required, and no business verification required.** those gates only apply to **advanced access**, which is the tier for apps that manage accounts they don't own. this is materially less painful than the prompt's framing suggested — w.v can ship without entering the app review queue at all.

**available metrics:**
- account-level (`GET /<ig_account_id>/insights`): impressions, reach, profile views.
- media-level (`GET /<ig_media_id>/insights`): engagement, impressions, reach, comments, likes, views.
- audience demographics, story metrics, reels metrics also available.
- "total metrics are only available for instagram api with facebook login" — facebook-login path is preferable for aggregates.

**blockers:**
1. is the windedvertigo instagram a business or creator account? (personal = dead end)
2. who is the admin? garrett or payton — and is that account the one that will register the meta developer app?
3. for the facebook-login path: is the instagram account linked to a facebook page that w.v controls?

**phase 1 recommendation:** manual entry. payton already pulls these numbers for the weekly cmo review — add a simple form on `/strategy` (admin-only) that writes follower count and last-week reach to a supabase row. takes ~30 min of dev work after substack form lands (same form pattern).

**phase 2 recommendation:** instagram graph api via facebook-login path. once the three blockers above are resolved:
1. register a meta developer app under the w.v facebook business
2. configure instagram graph api product, add the page + ig account
3. complete oauth flow (standard access — no review queue), store long-lived access token in cf secrets
4. cron job (cf workers) hits `/insights` daily, writes to supabase

complexity estimate: 1-2 days dev work after meta-side setup. the meta-side setup is mostly waiting for token issuance, not approval.

**garrett action items:**
- [ ] confirm w.v instagram account type (business / creator / personal)
- [ ] confirm admin (garrett vs payton) and whether the same person admins the linked facebook page
- [ ] register meta developer app under w.v facebook business (one-time, ~15 min)
- [ ] grant the app `instagram_basic` + `instagram_manage_insights` + `pages_read_engagement` for standard access

---

## linkedin

**status:** active but gated. organic company-page analytics live under the **community management api**, which is a vetted product with a two-tier approval flow including a screencast demo.

**api:** community management api — covers exactly what's needed for organic page analytics:
- **follower-statistics** (lifetime + time-bound)
- **page-statistics** (views, clicks)
- **share-statistics** (per-post lifetime + time-bound)
- **social-metadata** (reactions, comments — replaces the older socialActions endpoint)
- **video-analytics** (watch time, views, viewers)

(the prompt's note that "organic post analytics are limited" is out of date — the 2026 community management api covers this surface area well. the constraint is the approval flow, not the data.)

**auth requirements:** oauth 2.0, requires a **linkedin company page** (not just personal profiles). developer app must be approved into:
- **development tier** — initial approval, capped at 500 req/app and 100 req/member
- **standard tier** — full access, requires submitting a **screencast demo of each use case**

api versioning is monthly. version `202504` and earlier are sunset; live versions are `202505` onward.

**available metrics:** follower count + growth, page views, post-level reactions/comments/shares/clicks, video metrics. lifetime + date-bounded queries. no impression-level granularity for organic posts (that's still ads-only).

**blockers:**
1. does w.v have a linkedin **company page** (not just personal accounts)?
2. who has page admin / super-admin?
3. willing to invest the screencast + standard-tier approval cycle? (development tier alone is too rate-limited for daily syncs across the team.)

**phase 1 recommendation:** weekly csv export. payton (or whoever owns the page) exports the linkedin analytics csv weekly via the page admin panel → uploads to a known google drive folder → port has a small worker that reads the latest csv and updates supabase. zero approvals, ships in a day. this is the right phase 1 even with the corrected api picture — the screencast cycle is multi-week.

**phase 2 recommendation:** community management api integration, but only after the page admin is confirmed and someone commits to recording the screencasts. realistically a 2-3 week project including approval lag. start with development tier for proof-of-concept, upgrade to standard once the integration is demonstrable.

**garrett action items:**
- [ ] confirm w.v linkedin company page exists (or create one)
- [ ] confirm who has super-admin role
- [ ] decide who owns the weekly csv export in phase 1 (payton most likely)
- [ ] decide whether standard-tier api (with screencast investment) is worth pursuing in q3 vs sticking with csv

---

## substack

**status:** limited. **no official api** for subscriber counts, open rates, or post analytics — confirmed unchanged in 2026. manual entry is the answer.

**api:** none official. three workarounds exist:
1. **manual entry** — recommended for phase 1 and probably permanently.
2. **dashboard scraping** — fragile, breaks on every substack ui change, and risks tos issues.
3. **email-driven tracking via resend** — only works if w.v shifts substack delivery through resend, which it currently does not.

substack does offer a csv export of the **subscriber list** (emails), but not stats like opens, clicks, or growth.

**auth requirements:** n/a. publisher login only.

**available metrics:** via manual lookup in the substack dashboard — total subscribers, paid subscribers, opens, clicks, growth deltas. publisher must transcribe these.

**blockers:**
- no api. that's the whole story.
- person who has time to do the monthly transcription.

**phase 1 recommendation:** manual monthly entry. add a simple form on `/strategy` (admin-only):
- field: subscribers (number)
- field: paid subscribers (number)
- field: snapshot date (defaults to today)
- writes to a `social_metrics_substack` supabase row
- kpi card reads the latest row

takes ~1-2 hours of dev work, unblocks the card immediately.

**phase 2 recommendation:** revisit only if w.v moves substack-style sends to resend. then track opens/clicks server-side. until then, manual entry is the right answer — the data only changes monthly anyway, and manual entry forces a brain-loop that auto-ingestion would skip.

**garrett action items:**
- [ ] decide who owns the monthly substack number (probably payton)
- [ ] confirm with payton that monthly cadence is sufficient (vs weekly)
- [ ] sign off on adding an admin form pattern to `/strategy` that other manual-entry kpis can reuse

---

## bluesky

**status:** open. at protocol is fully public, no approvals, free. **friction is so low that phase 1 manual entry should be skipped — go straight to api.**

**api:** at protocol via `app.bsky.*` namespace. relevant endpoints:
- `app.bsky.actor.getProfile` — returns `followersCount`, `followsCount`, `postsCount`. **no auth required for public profile data** (confirmed via docs.bsky.app).
- `app.bsky.feed.getAuthorFeed` — recent posts.
- `app.bsky.feed.getPostThread` — engagement (likes, reposts, replies) on a specific post.

base url for unauthenticated reads: `public.api.bsky.app`. for authenticated reads (slightly richer metadata): `bsky.social` after creating a session with `com.atproto.server.createSession`.

**auth requirements:** none for follower count + public post engagement. for richer metadata, app password flow:
1. user generates an app password in bluesky settings (separate from main password)
2. exchange app password for access + refresh token
3. tokens expire in minutes (access) and hours (refresh) — must rotate

free, no developer account, no approval.

**available metrics:** follower count, following count, post count, per-post likes/reposts/replies. no impression data (bluesky doesn't expose this).

**rate limits:**
- public appview: "generous" unauthenticated limits
- hosted pds: 3000 req/5min per ip
- session creation: 30 per 5 min per account

plenty of headroom for a once-a-day kpi sync.

**blockers:** none. the only open question is whether w.v has a bluesky handle at all.

**phase 1 recommendation:** **skip the manual phase.** go directly to api. half-day of dev work. cf worker hits `getProfile` daily for the w.v handle (unauthenticated, no token storage needed for follower count), writes follower count to supabase. this is the best proof-of-concept for the cf-worker → supabase → kpi-card pipeline because it has zero approval friction.

**phase 2 recommendation:** add per-post engagement aggregation if/when bluesky becomes a more central channel. would require app-password auth + token rotation but the api is already mapped.

**garrett action items:**
- [ ] confirm the w.v bluesky handle (and that there is one — if not, decide whether to register one)
- [ ] decide whether per-post engagement matters now or if follower count alone is enough for the strategy card

---

## summary table

| platform | priority | status | phase 1 | phase 2 | garrett blockers |
|---|---|---|---|---|---|
| substack | 1 (unblock now) | no api, ever | admin form, monthly manual entry | resend integration if email workflow shifts | who owns monthly entry |
| bluesky | 2 (quick win) | open api, free, no auth needed | skip — go direct to api | per-post engagement | confirm handle exists |
| instagram | 3 (high value) | graph api, **standard access — no review** | admin form, weekly manual entry | graph api with facebook-login path | account type, admin, fb page link |
| linkedin | 4 (slow approval) | community management api, vetted (screencast) | weekly csv export | community management api standard tier | company page exists, page admin, screencast investment |

---

## next 3 actions

1. **garrett: answer the five blocker questions** above (instagram account type + admin, linkedin company page + admin, substack monthly owner). without these, no further work moves. estimate: 30 min if done in one sitting.

2. **build the manual-entry form pattern on `/strategy`** as a reusable component. substack lands first; instagram + linkedin reuse the same shape. backed by a `social_metrics_*` supabase table per platform with `(snapshot_date, metric_name, value, source)` columns so phase 2 api ingestion can write to the same table without schema migration. estimate: 1 day.

3. **ship the bluesky integration** in parallel with #2 — it's the only platform with no blockers and no manual phase. half-day of dev. proves out the cf-worker → supabase → kpi-card pipeline that instagram will reuse later.

---

*verified against current platform docs 2026-05-04. sources:*
- *meta: https://developers.facebook.com/docs/instagram-platform/overview, https://developers.facebook.com/docs/instagram-platform/insights*
- *linkedin: https://learn.microsoft.com/en-us/linkedin/marketing/community-management/community-management-overview*
- *bluesky: https://docs.bsky.app/docs/get-started, https://docs.bsky.app/docs/advanced-guides/rate-limits, https://docs.bsky.app/docs/api/app-bsky-actor-get-profile*
- *substack: no public api docs available in 2026; confirmed by absence and community precedent*
