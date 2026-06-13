# Tasks

## Nordic — CAIPB Dashboards + Authority Regions Editor (2026-06-13) — feat/caipb-dashboards

Branch cut from `main` (which includes the merged governance-persistence-and-multiregion work).

### PART 1 — CAIPB Dashboards (browse mode)
- [x] **`GET /api/pcs/caipb/ingredient/[id]`** — ingredient + formula lines (with fmPlm) + form usage rollup + benefit categories + claims (region-aware). Gated via `pcs.market-explorer:view`.
- [x] **`GET /api/pcs/caipb/benefit/[id]`** — benefit category + claims + ingredient aggregation (region-aware). Gated via `pcs.market-explorer:view`.
- [x] **`GET /api/pcs/caipb/product/[id]`** — document + versions + formula lines + claims grouped by benefit category (region-aware). Gated via `pcs.market-explorer:view`.
- [x] **`/research/pcs/caipb`** — hub page with ingredient / benefit / product pickers. Super-user-gated.
- [x] **`/research/pcs/caipb/ingredient/[id]`** — forms+sources table, benefit categories panel, form usage % bar chart, product usage table with FM PLM#. Cross-links to benefit + product dashboards.
- [x] **`/research/pcs/caipb/benefit/[id]`** — ingredients list + claims list, region filter, cross-links to ingredient dashboards.
- [x] **`/research/pcs/caipb/product/[id]`** — claims grouped by benefit category, formula lines with FM PLM#, version history. Cross-links to ingredient + benefit dashboards.
- [x] **Sidebar** — "CAIPB Dashboards" added to Marketing Intelligence ✦ group in `sidebar-items.js`.

### PART 2 — Region-aware + Authority Regions Backfill Editor
- [x] **`src/lib/pcs-claims.js` `updateClaim()`** — `authorityRegions` now writes `multi_select` to Notion; Postgres write path already worked via stub row.
- [x] **`PATCH /api/pcs/claims/[id]`** — accepts + validates `authorityRegions` against `CLAIM_AUTHORITY_REGIONS`.
- [x] **`AuthorityRegionsEditor`** — chip-toggle multi-select on claim detail page, gated to `canWrite` (researcher/ra/admin/super-user). Saves via PATCH.
- [x] **Authority regions display** — chip row on claim detail (read-only for all viewers, edit chips for writers).

### Tests
- [x] **`tests/caipb.verify.mjs`** — 22 tests: form usage rollup, benefit category aggregation, region filtering, authorityRegions patch validation, cross-link integrity. All pass.
- [x] **`verify:caipb`** added to `package.json`; `verify:all` extended.

### Pending
- [ ] **Push to Garrett for review**: `feat/caipb-dashboards`. **Do NOT push to main**.
- [ ] **Data backfill**: `authority_regions` data is empty (schema only). Research team to populate via `AuthorityRegionsEditor` on claim detail pages.
- [ ] **Update handoff doc** at `.brain/memory/handoff/2026-06-13-nordic-caipb.md`.

---

## Nordic — Governance Persistence + Multi-region (2026-06-13) — feat/governance-persistence-and-multiregion

Branch cut from `feat/budget-c-and-gates-preview`. Inherits all governance persistence wiring from that branch.

### GAP 1 — Persist governance layer to Supabase
- [x] **`supabase/migrations/20260613000001_018_pcs_review_gate.sql`** — Three tables: `pcs_review_events` (append-only with Postgres rules), `pcs_governance_config` (singleton), `pcs_governance_rules` (seeded with 2 defaults).
- [x] **`src/lib/pcs-review-events.js`** — Persistence layer: `appendReviewEvent()`, `getReviewEvents()`, `getRecordGateStatus()`, `getGovernanceConfig()`, `updateGovernanceConfig()`, `getGovernanceRules()`, `upsertGovernanceRule()`.
- [x] **`POST /api/pcs/review`** — wired to call `appendReviewEvent()` (non-fatal on failure).
- [x] **`deriveGateStatus(events[])`** — pure function added to `review-gate.js`; replaces inline derivation in `pcs-review-events.js`.
- [x] **verify:review-gate** — extended with 9 new `deriveGateStatus` tests (106 total, 0 failed).

### GAP 2 — Surface ReviewStatusBadge on detail pages
- [x] **`src/components/ReviewStatusBadge.js`** — shared badge component (created on `feat/budget-c-and-gates-preview`).
- [x] **`GET /api/pcs/review/status`** — endpoint for single-record gate status.
- [x] **Evidence detail** (`/research/pcs/evidence/[id]/page.js`) — badge wired.
- [x] **Claim detail** (`/research/pcs/claims/[id]/page.js`) — badge wired.
- [x] **Canonical-claim detail** (`/research/pcs/canonical-claims/[id]/page.js`) — badge wired.

### NEW — Multi-region / multi-authority dimension
- [x] **`CLAIM_AUTHORITY_REGIONS`** — constant exported from `pcs-config.js` (FDA, EFSA, Health Canada, TGA, FSANZ, Japan MHLW).
- [x] **`supabase/migrations/20260613000002_019_claim_authority_regions.sql`** — `authority_regions TEXT[]` column + GIN index on `pcs_claims`.
- [x] **`src/lib/pcs-claims.js`** — `parsePostgresRow` and `parsePage` updated to map `authorityRegions`.
- [x] **`src/lib/pcs-explorer.js`** — `filterByRegion(rows, region)` exported; all 3 query functions accept `{ region }` option.
- [x] **`GET /api/pcs/explore`** — accepts `region` query param, returns `region` in response.
- [x] **`/research/pcs/explore`** — region/authority selector added; Authorities column added to ExplorerTable; re-queries on region change.
- [x] **`tests/pcs-explorer.verify.mjs`** — new file, 23 tests: `filterByRegion` edge cases + `CLAIM_AUTHORITY_REGIONS` contract. Added to `verify:all`.
- [ ] **Data backfill**: `authority_regions` data is empty (schema only). Research team to populate via manual review. Flagged in handoff.

### Pending
- [ ] **Push to Garrett for review**: feature branch `feat/governance-persistence-and-multiregion`. **Do NOT push to main**.
- [ ] **Supabase migrations**: run `20260613000001_018_pcs_review_gate.sql` and `20260613000002_019_claim_authority_regions.sql` on the live DB after Garrett reviews.

---

## Nordic — Parts B + C: Expert Gates & Governance (2026-06-13) — feat/budget-c-and-gates-preview

- [x] **`src/lib/review-gate.js`** — reusable expert-in-the-loop gate library (pure logic, no I/O). Exports: `GATE_MODES` (4 modes), `GATE_STATUS`, `AUDIT_ACTION`, `createAuditEvent()` (frozen/immutable), `validateStatusTransition()`, `applyRule()` / `checkRuleViolations()`, `isRubberStamp()`, `computeCorrectionRate()`, `computeTimeSaved()` (explicit baselines, always `isEstimate: true`), `computeRuleAdherence()`.
- [x] **DEFAULT_GATE_MODE** = `human-first-ai-verify` (Sharon's preference: human reads + enters, AI verifies alignment after).
- [x] **3 new capabilities** in `capabilities.js`: `pcs.review:approve` (researcher/ra/admin/super-user), `pcs.review.rules:edit` (ra/admin/super-user), `pcs.governance:manage` (super-user-only in `SUPER_USER_ONLY_CAPABILITIES` → live re-verify).
- [x] **`POST /api/pcs/review`** — submit review actions (approve/correct/reject/request-changes) with role gate.
- [x] **`GET /api/pcs/review/queue`** — unified review queue, filterable by type and confidence.
- [x] **`GET|POST /api/pcs/governance`** — governance toggle (super-user only). Ships OFF by default.
- [x] **`GET|POST /api/pcs/governance/rules`** — admin/RA define which gate mode applies per record type.
- [x] **`GET /api/pcs/governance/metrics`** — correction rate, time-saved estimate, rule adherence.
- [x] **`/research/pcs/governance`** — management dashboard for Sharon: toggle, metrics, rules, time-saved assumptions.
- [x] **`/research/pcs/review-queue`** — unified review queue UI with status badges.
- [x] **`ReviewStatusBadge`** exported from review-queue page for platform-wide use.
- [x] **Sidebar** — "Review Governance ✦" group added to super-user layout only.
- [x] **verify:review-gate** — 97 tests: all acceptance criteria from spec §7. `verify:all` green (355 total).
- [ ] **Pending Garrett review**: push feature branch `feat/budget-c-and-gates-preview` to GitHub. **Do NOT push to main**.
- [ ] **After Garrett demo to leadership**: flip governance toggle ON via `/research/pcs/governance`.
- [ ] **Persistence**: connect governance config + rules + audit log to Supabase (in-memory stubs currently reset on cold start).
- [ ] **Status badges**: add `ReviewStatusBadge` to claim detail, evidence detail, and canonical claim pages.

## Nordic — Budget C Preview (2026-06-13) — feat/budget-c-market-explorer-preview

- [x] **Budget C Marketing Intelligence Interface** (`/research/pcs/explore`) — super-user-gated, three lenses (by benefit category, by ingredient, by product). Results table: Claim · Ingredient/Dose · Benefit Category · Evidence (# studies) · Substantiation Status · PCS Reference.
- [x] **Substantiation Status** — transparent Supported/Thin/Unsupported derived from evidence count + SQR-RCT normalized scores (0–1). Thresholds in `SUBSTANTIATION_THRESHOLDS` config constant. Hover badge shows inputs.
- [x] **Substantiation Dossier export** — DOCX (uses existing `docx` library). Human sign-off field: omit → DRAFT watermark on every page. Provide name → final export attributed to named reviewer.
- [x] **Capabilities** — `pcs.market-explorer:view` + `pcs.dossier:export` added to `CAPABILITIES` + `SUPER_USER_ONLY_CAPABILITIES`. Live Notion re-verify on every API call (same gate as `pcs.revisions:revert`).
- [x] **Sidebar** — "Marketing Intelligence ✦" group added to super-user sidebar layout only. All other roles see nothing.
- [x] **verify:market-explorer** — 31 tests: capability registration, role gating (all 4 non-super roles blocked), threshold shape, normalizeSqrScore correctness, computeSubstantiationStatus all three outcomes.
- [ ] **Pending Garrett review**: push feature branch to GitHub once reviewed. Branch: `feat/budget-c-market-explorer-preview`. **Do NOT push to main** — push auto-deploys to `nordic.windedvertigo.com`.
- [ ] **Optional**: add Sharon to `PREVIEW_ALLOW_LIST` (single constant in `pcs-explorer.js`) when ready to let her demo herself vs. Garrett driving the demo.
- [ ] **Budget C payment** → widen role access beyond super-user.

## Whirlpool actions — 2026-05-20

From the may 20 whirlpool ([notion AI meeting](https://www.notion.so/366e4ee74ba48035836fca89b21386d6) · [agenda](https://www.notion.so/366e4ee74ba481f79453eb7516cd3872)). T-8 days to the may 28 harbour prime+ launch. Morning debriefed the Amna intro meeting, then a harbour crawl + co.rubric companion demo.

- [ ] **maria** — fix participant ID bug in co.rubric companion (blocks adding proposals to the board)
- [ ] **the group** — 30–60 min/day testing harbour apps + log feedback in `#harbour` slack (newcomer / facilitator / sceptic lenses)
- [ ] **garrett** — add live app links to the notion agenda + add a bug-report button to every harbour game
- [ ] **lamis** — develop landing-page copy for the harbour (purpose + user experience)
- [ ] **garrett** — meet with aaron (fruit) about creating illustrations for harbour piers
- [ ] **the group** — review + provide feedback on jamie's ubongo proposal draft
- [ ] **garrett** — add PDF export option to co.rubric companion (markdown alone is insufficient for teachers)
- [ ] **the group** — register for tomorrow's prime session if observing

## Whirlpool actions — 2026-05-18

From the may 18 whirlpool (harbour play lab format with aaron + marietta) ([Notes by Gemini](https://mail.notion.so/inbox/19e3c622c3c0d846) · [agenda](https://www.notion.so/364e4ee74ba4811793c0ca859e49455d)). T-10 days to the may 28 prime+ launch.

- [ ] **garrett** — request technical audit: ask august to evaluate the prime apps, analyze the harbour architecture, and perform comprehensive testing before may 28
- [ ] **the group** — review launch apps: conduct 15-minute review sessions for each prime+ app at wednesday's whirlpool to provide feedback + identify bugs
- [ ] **garrett** — debug strategy app: troubleshoot and fix the loading issues in the strategy application within port
- [ ] **lamis** — identify edtech journals: identify the top 20 edtech journals to target for article placement / outreach
- [ ] **jamie** — draft ubango proposal: sketch a proposal draft for the ubango opportunity inside the notion workspace
- [ ] **jamie** — upgrade claude plan: upgrade to claude max subscription to enable second-brain capabilities
- [ ] **jamie** — evaluate claw tool: play with the tool to determine if it provides sufficient value for current work
- [ ] **the group** — debrief omna: review the omna conversation during the wednesday may 20 whirlpool
- [ ] **the group** — discuss proposals: evaluate the ubango and unicef proposals at the wednesday meeting

## Whirlpool actions — 2026-05-13

From the may 13 whirlpool meeting recording ([Notes by Gemini](https://docs.google.com/document/d/1xlFszMKFsNQLXi365rfRj5lA6rtb-NPjvJmu173Z1sY/edit) · [Transcript](https://docs.google.com/document/d/1xlFszMKFsNQLXi365rfRj5lA6rtb-NPjvJmu173Z1sY/edit?tab=t.anee4cn9bvig) · [agenda](https://www.notion.so/35fe4ee74ba4818483c5c797e791790a)). The session shifted from the substack/harbour/Play@TED agenda into a focused website working session.

- [ ] **garrett** — fix Website Load: resolve the "Do" page loading issue on windedvertigo.com
- [ ] **the group** — catalog assets: pull existing assets Maria created for PRIME over the years; make tangible, accessible, and ready for showcasing
- [ ] **garrett** — update homepage: clean up the "What" page hero copy (change "learning is change" to more explicit language), add a middle sentence outlining the 3 bullet points of what w.v does (research, products, experiences)
- [ ] **garrett** — pause motion: implement a button option on the website enabling users to stop motion effects (e.g. "What" wobbling, "Do" quadrant spinning) — accessibility play
- [ ] **payton** — process thinkpiece: take the "play with learning through play" content and give it a graphics treatment; post alongside Jamie's other written materials
- [ ] **jamie** — hand off content: hand off think pieces and relevant assets to Payton for social campaigns / posting
- [ ] **garrett** — implement hyperlinks: add "dive deeper" buttons/hyperlinks on the "What" page for key concepts (low-stakes environment, design process) → link to longer philosophical thinkpieces

## Whirlpool actions — 2026-05-06

From the may 6 whirlpool meeting recording ([notion AI meeting](https://www.notion.so/358e4ee74ba480d7a270f44aa2dad4bd) · [agenda](https://www.notion.so/356e4ee74ba481f6bfa6e5487e1721d4)).

- [ ] **Jamie** — finalize "Learning to Fly" Substack piece by Friday (preferred) or Monday at latest, hand off to Payton
- [ ] **Team** — review Learning to Fly draft using track changes and provide feedback
- [ ] **Payton** — post Learning to Fly Substack on Wednesday (May 13)
- [ ] **garrett** — create Harbour tool review forms for priority apps by Monday
- [ ] **Jamie** — outline 6 follow-up Substack posts and share in Studio Comms channel
- [ ] **Team** — focus Harbour launch (May 28) on Prime Plus / adult / higher-ed audience
- [ ] **Team** — prepare kids/family Harbour apps for end-of-June launch (school holidays + Prime Global conference timing)
- [ ] **garrett** — create crease animation showing iterative writing process (track-changes/draft evolution + song)
- [ ] **Jamie** — share accessibility guide in Studio Comms for Claude training

## Completed 2026-05-05 — Nordic Research Platform: PCS evidence Wave 7.0.5

Full debrief in `.brain/handoff.md`. App: `apps/nordic-sqr-rct`. Branch: `ghandoff/windedvertigo`. Deploys to `nordic.windedvertigo.com` (Vercel).

- [x] **Research-team article search tool at `/pcs/evidence`** (`ff7f591`) — DOI / PMID / title → PubMed + Semantic Scholar hits → 7-tier PDF retrieval waterfall (`src/lib/pmc.js`) → Vercel Blob `evidence-pdfs/`. Endpoint: `POST /api/pcs/evidence/save-from-search`.
- [x] **PubMed MeSH auto-classify into EVIDENCE_TYPES** (`eb7ebf5`) — RCT / Meta-analysis / Systematic review / Observational / Review. No more "everything is RCT" defaulting.
- [x] **In-library detection** (`3a8ace2`) — search hits cross-check existing rows by DOI/PMID; saved rows show "✓ In library / Open existing row →"; saved chip is clickable Link to detail page.
- [x] **Manual PDF upload for paywalled / EndNote-only rows** (`c548317`) — `POST /api/pcs/evidence/[id]/pdf-upload` multipart route + UI button + drag-and-drop on evidence detail page.
- [x] **Hard-merge dedup** (Wave 7.0.5 T8.1, in flight at handoff write) — `createEvidence` returns existing rows on DOI/PMID match instead of duplicating; surfaces `merged` flag.
- [x] **Phase 1 perf** (`e7bf068`) — `revalidate` + `s-maxage` cache headers on five `/api/pcs/*` GET routes; `revalidatePath()` on POST/PATCH; `loading.js` skeletons for four pages. Edge-cache HIT serves `/api/pcs/evidence` in 33ms (was 500–1500ms cold).
- [x] **Default-sort improvements** (`594f8b1`) — `PcsTable` accepts `defaultSortKey` + `defaultSortDir`; evidence page sorts `lastEditedTime DESC`; newly-added rows default to top + jump-to-row from save. localStorage key bumped to `pcs-sort-v2-`.
- [x] **One-shot test-pollution dedup** (`bb0e8c5`) — archived 3 rows. Script: `apps/nordic-sqr-rct/scripts/archive-test-evidence-rows.mjs`.
- [x] **Salvage from archived working tree** (`1854467`) — 4 unique docs migrated from standalone `~/Projects/nordic-sqr-rct/` to monorepo. Standalone renamed to `~/Projects/nordic-sqr-rct.archived-2026-05-05/`.

### Pending — Nordic platform follow-ups

- [ ] **Set `SEMANTIC_SCHOLAR_API_KEY` + `CORE_API_KEY` on Vercel prod env** — without them the article-search waterfall returns 429 on those two tiers (effective coverage 5/7). Highest-leverage env-var task on the platform right now.
- [ ] **Verify T8.1 hard-merge after it lands** — confirm `merged: true` returns when DOI/PMID matches an existing row, and that the existing-row return path still runs the EVIDENCE_TYPES classifier (regression risk).
- [ ] **UX sweep follow-ups** — placeholder until `apps/nordic-sqr-rct/.brain/ux-sweep-2026-05-05.md` lands from the parallel agent. After it lands: read top items, surface here, prioritise.
- [ ] **Phase 2 perf** — parallelize sequential Notion queries inside `/api/pcs/*` routes; add in-memory cache per Fluid Compute instance. Defer until the team uses Phase 1 for a workday so we have real hit-rate data to optimize against.
- [ ] **Phase 3 perf (multi-day, deferred)** — Notion → Supabase mirror for `/pcs/*` read paths. Same pattern as Port's Phase A2. Don't start until Phase 2 is exhausted.
- [ ] **`pcs.evidence:attach` audit** — capability scope now gates three write paths (`POST /api/pcs/evidence`, `save-from-search`, `pdf-upload`). One sweep to confirm no path is accidentally open.

## Completed 2026-05-04 (afternoon PT) — RFP Pipeline v2 Phase 1

Architectural upgrade based on the plan + industry research at `~/.claude/plans/generic-popping-bubble.md` (research separately at `~/.claude/plans/generic-popping-bubble-agent-a2328100cdbfe445b.md`). Full debrief in `.brain/memory/engineering/rfp-pipeline-v2.md`.

- [x] **Schema migration** `20260508_rfp_pipeline_v2.sql` — 4 new tables (`rfp_requirements`, `rfp_milestones`, `rfp_assignments`, `collective_cv`) + `rfp_coverage` view + 9 new columns on `rfp_opportunities` (TOR verify, bid decision, EOI/financial URLs)
- [x] **CV seed** from `TEAM_BIOS` (Garrett, Lamis, James/Jamie, Maria, Payton)
- [x] **Pass-2 requirement extractor** (`lib/ai/rfp-requirements-extractor.ts`) — Claude pulls structured deliverables / eligibility / evaluation criteria / admin / submission rows with provenance (extracted_by, confidence, source_quote)
- [x] **rfpDocumentConsumer extended** to write `rfp_requirements` rows after question-bank parse
- [x] **proposal-generator RFP-aware** — accepts `requirements` in context, system prompt emits `deliverables` array driven by approved rows, backward-compat backfill from legacy boolean+string fields
- [x] **proposalConsumer refactored** — single loop over `draft.deliverables` for sub-page creation (variable count), per-contributor `fanOutContributorAssignments()` after generation
- [x] **Verification gate UI** on `/rfp-radar/[id]` — TOR confirm + per-row approve/edit/remove + readiness banner
- [x] **API routes**: `verify-tor`, `requirements`, `requirements/[reqId]`, `bid-decision`, `cv/verify-mine`
- [x] **Bid/No-Bid scorecard** modal in kanban (5 weighted yes/no questions, fires on `reviewing → pursuing` drag)
- [x] **Milestone reminder cron** `/api/cron/milestone-reminders` registered (9/12/15/18 UTC)
- [x] **Per-contributor Slack DMs** in proposalConsumer (sendDmByEmail bot path) with section + CV-verify deep links
- [x] **Both workers deployed** — `wv-port` + `wv-port-jobs`

### Phase 2 (deferred)
- [ ] Answer library + confidence-scored auto-fill (Loopio "Loop Library" pattern)
- [ ] Slack Block Kit interactive buttons (replace deep-link CV verify with native button)
- [ ] Calendar events per milestone (extend existing GCal deadline-event integration)
- [ ] Pre-submission gate UI: block "mark submitted" until coverage view all-green
- [ ] Phase 3: submission tracking + win/loss retrospectives feeding back into prompt library

## Completed 2026-05-04 (morning) — 4-doc RFP generator + 2nd RFP shipped

- [x] **Cost cut: switched proposal-generation from sonnet to haiku-4.5** (~5× cheaper, ~$0.50/proposal vs ~$3). `lib/ai/types.ts` FEATURE_MODELS map.
- [x] **4-document generator deployed** (port-jobs version `686bfbbd`) — `proposal-generator.ts` ProposalDraft now includes `requiresExpressionOfInterest`/`expressionOfInterest` + `requiresFinancialProposal`/`financialProposal`. `port-jobs/src/index.ts` creates 📝 EOI sub-page + 💰 Financial Proposal sub-page when AI flags them. Slack summary surfaces all 5 URLs.
- [x] **Changemakers in Family Planning RFP shipped** (May 12 deadline) — 3 docs all live. URLs in handoff.md.
- [ ] **EOI + Financial Proposal URLs not yet in Supabase** — currently only on Notion + Slack. To track on RFP detail page UI, add `expression_of_interest_url` + `financial_proposal_url` columns to `rfp_opportunities` and extend `setProposalUrls`. Not blocking for the user.
- [ ] **UNICEF Global LTAS** — failed twice (May 8 deadline still 4 days out). Next attempt in flight at 12:48 PT. If fails again: switch UNICEF specifically to sonnet, OR trim its question bank size.

## Completed 2026-05-04 (overnight) — Oxfam Denmark RFP shipped + off Vercel AI Gateway

- [x] **Oxfam Denmark RFP proposal drafted** (8am deadline) — full proposal, cover letter, and team CVs generated to Notion. Links in `.brain/memory/handoff.md`.
- [x] **Vercel AI Gateway dependency killed** — `port/lib/ai/client.ts` now calls `api.anthropic.com` directly with a `sk-ant-api03-*` key (created `wv-port-jobs-cf` via Anthropic Console). No more Vercel AI gateway routing or charges.
- [x] **`port/lib/ai/client.ts` lazy-init Proxy** — same pattern as Notion + Supabase clients. Anthropic key rotations propagate without redeploy.
- [x] **`AI_GATEWAY_API_KEY` and `ANTHROPIC_BASE_URL` (gateway URL) deleted from wv-port-jobs.** Old `ANTHROPIC_API_KEY` (60-char gateway key) still in env but unused — safe to revoke at vercel.com when convenient.

### Pending in morning
- [ ] **Regenerate 3 remaining RFPs** (UNICEF May 8, Changemakers May 12, Evaluation May 25). They DLQ'd during the architecture flip. See playbook in `.brain/memory/handoff.md`. Note the `regenerate-pursuing` admin route also claims `ready-for-review` rows — needs a one-line filter fix OR temporarily flip Oxfam's `status` field before triggering.
- [ ] **Revoke Vercel AI Gateway key + cancel gateway product** at vercel.com if not already used by other apps. Check creaseworks/vault first — they may have their own AI calls routed through it.
- [ ] **Audit findings from `.brain/memory/engineering/2026-05-04-supabase-mirror-audit.md`** — 6 drift sites need cleanup (campaigns cron, rfpDocumentConsumer, etc.)

## Completed 2026-05-04 — RFP generation root-cause fix (CRITICAL)

- [x] **RFP proposal generation root cause identified + fixed** — Two compounding bugs in `port-jobs/src/index.ts` were silently breaking proposal generation:
  1. The CF Workers migration from Inngest **dropped every `setProposalStep()` and `setProposalStatus()` call** to Supabase. The consumer only wrote status to Notion; the polling UI reads from Supabase. Result: even successful generations stayed at `proposal_status='generating'` in Supabase indefinitely (until the 15-min cron sync), and failed generations stayed there forever (the DLQ also only reset Notion).
  2. `seedProcessEnv()` set `SUPABASE_URL`/`SUPABASE_SERVICE_KEY` but the supabase client reads `NEXT_PUBLIC_SUPABASE_URL`/`SUPABASE_SECRET_KEY`. Even if the consumer had tried to write, it would have thrown.
  Fix: imported `setProposalStep` / `setProposalStatus` / `setProposalUrls` / `resetProposalToFailed`; added `advance(step)` and `failWith(reason)` helpers wrapping every checkpoint; fixed env-var seeding; added 6-min `Promise.race` timeout around the Claude `generateProposal` call. DLQ now also resets Supabase. Worker `wv-port-jobs` redeployed: version `92ac362e-b35d-4e3a-b735-8e20824637e4`.
- [x] **Reset 4 stuck RFP statuses** — Oxfam Denmark, UNICEF Global LTAS, Changemakers in Family Planning, Evaluation Consultant — all 4 had `proposal_status='generating'` for 4-5 hours. Reset to `failed` with `proposal_step='reset_by_admin'` so user can retry.
- [x] **Live progress UI on RFP detail page** — `port/app/components/proposal-progress.tsx` extended: `useElapsed` returns `{label, ms}`; red banner triggers when elapsed >10min while still generating; amber banner surfaces `proposal_step` values starting with `failed_at_` (race-window state where Supabase has the failure detail before status flips). Polls every 3s. Step taxonomy: `fetching_rfp` → `gathering_context` → `reading_document` → `matching_citations` → `writing_draft` → `building_documents` → `cover_letter` (optional) → `team_cvs` (optional) → cleared on success; on failure `failed_at_<lastStep>: <error>`.
- [x] **Strategy "create with claude" button** — `app/(dashboard)/strategy/create-with-claude-button.tsx` + `/api/strategy/create-campaign` route. On strategy cards with "no crm match" badge, clicking opens a Claude Sonnet draft → creates a CRM campaign with name, type, audience filter, draft email subject, draft email body, internal notes. Payton reviews + refines.
- [x] **Sync now button + social-stats backfill** — `app/(dashboard)/strategy/sync-now-button.tsx`; pulls broadened to last 90 days (was last 10 posts); added `port` block to `SocialStatsSnapshot` from `email_drafts` table (`getPortCampaignStats()` in `lib/marketing/port-campaign-stats.ts`); strategy sidebar relabeled "media mentions" → "campaign reach". Worker `wv-port` deployed: version `d98056fb-24c4-4613-8c5b-0ee7a4612823`.

### Pending after this session
- [ ] **Set 7 missing social env vars on `wv-port`** to populate non-Bluesky platforms (LinkedIn, Substack, Meta/FB+IG). Bluesky already live (3 followers, 6 engagements). See list in `.brain/memory/handoff.md`.
- [ ] **Investigate empty `email_drafts` table** — 0 rows, 0 sent. Either campaigns haven't actually been sent through the port pipeline, or sends went through a different path (Resend webhook? Notion-driven?). Until this is resolved, "campaign reach" stat stays at 0 even after social env vars are set.

## Completed 2026-05-04 — port marketing + strategy session

- [x] **Email drafts → Supabase migration** — `email_drafts` table with 5 indexes; `lib/supabase/email-drafts.ts` module; `app/api/cron/sync-email-drafts-pilot/route.ts` (every 6h: 1/7/13/19); 6 caller files swapped (campaign-stats-strip, campaign-weekly-summary, analytics, recipients, organizations/[id], view/[id]). Closes the last graceful-degradation gap on the port.
- [x] **Marketing strategy page (`/strategy`)** — server-component dashboard at `port/app/(dashboard)/strategy/page.tsx`. Two-column layout: revenue pipeline table + 90-day timeline + 6 campaign cards + budget on left; q2-q3 targets, team accountability, weekly cadence on right. "strategy" nav added to outreach section in `nav-config.ts`.
- [x] **Strategy data corrections (2026-05-04)** — removed LEGO/Superskills (years-old proposal, not active) and UNICEF (no acceptance received) from pipeline; PRME 2026 contract bumped from $48,285 (first invoice) to $145,000 (full signed contract); contracts-signed sidebar now shows layered bar (received/booked/gap) at 29% of $500k target.
- [x] **Campaign architecture clickable** — each strategic campaign card on `/strategy` now fuzzy-matches against existing CRM campaigns (`getCampaignsFromSupabase` + keyword match). Click opens the matching CRM campaign or a search filter; badge shows `N crm · M active` or `no crm match`.
- [x] **Stretch: content → campaign quick-draft** — `port/app/api/content/[id]/draft-to-campaign/route.ts` POST endpoint creates a campaign from an approved/scheduled content item (campaign type `recurring cadence`, since `social` isn't in the type union). UI button `draft-to-campaign-button.tsx` rendered on each draftable content item.
- [x] **Social-stats sync infrastructure** — `getStats()` added to all 4 social clients (linkedin, substack, meta, bluesky); new `sync-social-stats` cron at hours [3,9,15,21]; `/api/marketing/social-stats` GET route; snapshot stored in Supabase `marketing_state` table (key `social-stats`, conceptual KV mapping `marketing:social-stats`). Strategy page sidebar reads with graceful fallback. Migration `20260507_marketing_state.sql` applied.
- [x] **Memory cleanup** — LEGO/Superskills! and UNICEF removed from `CLAUDE.md`, `.brain/memory/operational.md`, `.brain/memory/financial.md`, `.brain/memory/marketing/strategy-2026-q2q3.md`, `.brain/memory/marketing/weekly-cmo-log.md`. PRME contract value updated to $145k throughout.

### Pending (post-this-session)
- [ ] **Set social env vars on `wv-port`** to populate real engagement data: `LINKEDIN_ACCESS_TOKEN`, `LINKEDIN_PERSON_URN`, `SUBSTACK_PUBLICATION` (+optional `SUBSTACK_COOKIE`), `META_PAGE_ACCESS_TOKEN`, `META_PAGE_ID`, `META_IG_USER_ID`, `BLUESKY_HANDLE`. Until set, social-stats snapshot returns nulls and progress bars show "awaiting first sync".
- [ ] **Trigger first social-stats sync** — `curl -H "Authorization: Bearer $CRON_SECRET" https://port.windedvertigo.com/api/cron/sync-social-stats` (or wait until next 03/09/15/21 UTC fire).

## Completed 2026-04-26 — harbour launch-readiness session

- [x] **Phase 0 wrap-up complete** — image-failure counter on harbour cron, sweep guard + restored 5 seeded SKUs (migration 053), doc drift closed.
- [x] **Phase 1 SSO verification** — Pool A (creaseworks/vault/depth-chart/harbour), Pool B (port), Pool C (ops) all verified via Chrome MCP. Three-pool architecture documented at `harbour-apps/docs/security/auth-pool-audit-2026-04-25.md`.
- [x] **Phase 2 + 2.5** — port AUTH_URL verified, /crm 308 verified, creaseworks AUTH_URL fix shipped (silenced env-url-basepath warnings).
- [x] **Phase 3a** — harbour magic-link signin live; joined Pool A SSO as 4th app. Same `userId f0e3ec80-…` across all four. `apps/harbour/lib/auth.ts` uses `createHarbourAuth({ appName: "" })`. 7 secrets on `wv-harbour-harbour` Worker.
- [x] **Phase 3b code + deploy** — Google OAuth on harbour. Reuses existing OAuth client `160968051904-ud88va6odnnjlp76j5dlc4qfd8upq2lp`. Worker version `8f5edc0d-…` live; `/api/auth/providers` lists both google + resend. *Functional click-through verification pending user adding redirect URI to Google Cloud Console.*
- [x] **Phase 4a security audit** — full audit at `harbour-apps/docs/security/launch-audit-2026-04-26.md`. 7 must-fix, 22 should-fix initially.
- [x] **Phase 4b Vercel-side** — vault headers, frame-ancestors on creaseworks/site/ops/port. Closed 7 should-fix items.
- [x] **Phase 4b harbour + depth-chart wrapper** — `@windedvertigo/security` package (`packages/security/`) ships `wrapWithSecurityHeaders` + `HARBOUR_DEFAULT_CSP`. harbour and depth-chart Workers wrapped, all 6 headers emitting. Closed 4 must-fix items + many should-fix.
- [x] **Phase 5a smoke script** — `harbour-apps/scripts/launch-smoke.mjs` covers 40 production targets with 3-retry backoff. 40/40 green at last run.
- [x] **Phase 5b smoke Worker deployed** — `wv-launch-smoke` Worker live, cron `*/30 * * * *`, KV `b67fcfef…`. Reads + writes to `latest` key; emits Slack digest on red when `WV_CLAW_WEBHOOK` secret is set. *Webhook URL pending user.*
- [x] **A2 prep — 16 CF Worker apps configured with security wrapper** — bias-lens, code-weave, deep-deck, emerge-box, liminal-pass, market-mind, mirror-log, orbit-lab, paper-trail, pattern-weave, proof-garden, raft-house, rhythm-lab, scale-shift, tidal-pool, time-prism. Each has `worker.ts`, updated `wrangler.jsonc` main field, tsconfig exclude, package.json dep. Deploy via `harbour-apps/scripts/deploy-cf-wrappers.sh`. Commit `042392e`.
- [x] **B1 — vault static CSP removed from vercel.json** — vault's `proxy.ts` (commit `79db6c3`) had a working nonce-based CSP that was being overridden at the edge by `vercel.json`'s static CSP. Removed the static entry; nonce-CSP becomes sole emitter on next vault deploy. Commit `dcbe3ab`.
- [x] **B4 — CSP nonce investigation doc** — `harbour-apps/docs/security/csp-nonce-investigation.md`. Recommendation: keep `'unsafe-inline'` on CF Workers fleet for launch; validate nonce pattern on vault first, then propagate post-launch.
- [x] **C2 partial — DNS audit** — SPF doesn't include `_spf.resend.com` (Resend emails fail SPF alignment), DMARC has no `rua=` reporting. Findings in `harbour-apps/docs/runbooks/launch-monitoring.md`.
- [x] **C4 — launch monitoring runbook** — `harbour-apps/docs/runbooks/launch-monitoring.md`. Triage trees, monitoring URLs, wrangler tail filters, smoke worker KV inspection, rollback procedures.
- [x] **Forward-roadmap plan written** — `~/.claude/plans/partitioned-painting-pascal.md` Phase A/B/C/D, sequencing, risks, done-when criteria. ONE 30-second user gate (A.1) for the entire pre-launch path.

### Completed (previously pending — done 2026-05-01/02)

- [x] **A.1**: harbour Google OAuth redirect URI confirmed in GCP client (Garrett confirmed 2026-05-01).
- [x] **A2 + A4**: `deploy-cf-wrappers.sh --include-depth-chart` run 2026-05-02 — all 16 apps + depth-chart live with `@windedvertigo/security` wrapper, 6 headers verified.
- [x] **A3**: `WV_CLAW_WEBHOOK` secret set on `wv-launch-smoke` — webhook to `#garrett-code-tasks` on wv-claw Slack app (2026-05-01).

## Completed 2026-04-25 — port infra consolidation session

- [x] **CF DNS zone consolidation** — windedvertigo.com zone activated 2026-04-25T01:43 UTC at garrett CF account (`097c92553b268f8360b74f625f6d980a`); migrated from anotheroption account.
- [x] **Port agent (wv-claw) deployed** — end-to-end tested in Slack DM. App `A0AUA3VQHFH` / bot `U0AUPLEA8RL` / audit DB `f2f48a9998d84cd69598efdc79a44f1e`.
- [x] **windedvertigo.com → Cloudflare Workers** — `wv-site` Worker live via OpenNext; Vercel `windedvertigo-site` project deleted.
- [x] **Harbour → Cloudflare Workers** — `wv-harbour-harbour` Worker live with R2 binding for tile images.
- [x] **Depth-chart on CF Workers** — fully wired with all secrets, direct CF routes (bypasses site router), end-to-end auth verified via shared `.windedvertigo.com` cookie.
- [x] **nordic.windedvertigo.com** — custom domain added on Vercel (project `nordic-sqr-rct`, kept on Vercel for Workflow DevKit + Vercel Blob).
- [x] **Vault image bucket public access restored** — after R2 account migration to garrett account.
- [x] **Vault read-time cover_url refactor** — computes from `cover_r2_key` at read time; future R2 migrations are env-var-only.
- [x] **Creaseworks R2 credentials repaired** — production now uses garrett-account keys.
- [x] **Harbour tile images centralized in R2** — admin sync endpoint at `/harbour/api/admin/sync-tiles`.

## Infrastructure / platform (queued — needs focused session)

Two related infrastructure projects surfaced during the R2 token-rotation incident on 2026-04-23. Both are medium-effort and should be tackled together in a single focused session, not piecemeal.

### Project: Cloudflare account consolidation

**Current state**: Assets split across two Cloudflare accounts.
- `garrett@windedvertigo.com` account: DNS zones, domain registrar ("Gearbox"/Cloudflare Registrar)
- `anotheroption@gmail.com` account (ID: `4f33ee381364bce6959bdea092f046bb`): R2 buckets (`crm-assets`, `creaseworks-evidence`), Workers, AI Gateway, etc.

**Target**: Everything under `garrett@windedvertigo.com`.

**Why it matters**: Split accounts mean two logins, two token sets, two billing surfaces, and ongoing confusion when rotating creds (like today's incident). Consolidation reduces cognitive load and blast radius.

**Plan outline** (needs refinement before execution):
1. Audit assets in both accounts — list every zone, bucket, worker, KV namespace, AI Gateway, etc.
2. Move DNS zones + domain registrations to `garrett@windedvertigo.com` via CF's transfer-between-your-accounts flow (low-risk — zones update propagate over minutes)
3. Recreate R2 buckets in target account (R2 buckets are not transferable; must rclone the data over)
4. Update Vercel env vars: `CF_ACCOUNT_ID`, `R2_*`, `R2_PUBLIC_URL`
5. Redeploy port + harbour; verify uploads + reads
6. Migrate Workers, KV, D1, AI Gateway bindings — recreate + redeploy
7. Delete old account's assets once verified
8. Rotate/deactivate old API tokens

**Effort**: 60–90 minutes once started; most time is the R2 object sync.

### Project: Rename "CRM" → "port" across infrastructure

**Current state**: Legacy "CRM" naming in places where code/config was renamed but infrastructure wasn't.
- R2 bucket name: `crm-assets` (should be `port-assets`)
- Vercel domain aliases: `wv-crm.vercel.app`, `crm.windedvertigo.com` (alongside `wv-port-*` + `port.windedvertigo.com`)
- Possibly Notion databases or other references

**Target**: Everything reads "port" (matches the in-app brand language).

**Plan outline**:
1. Audit every reference to "crm" / "CRM" across repos, Vercel project, Cloudflare, Notion
2. Bucket rename (recreate + sync, like the consolidation — R2 doesn't support direct rename)
3. Remove stale Vercel aliases (`wv-crm.vercel.app`, `crm.windedvertigo.com`) once nothing points at them
4. Update `R2_BUCKET_NAME` env var + `R2_PUBLIC_URL` if that's re-branded too
5. Redeploy; verify no broken links (especially user-shared URLs that embed the old domain)

**Effort**: 30–60 minutes if bundled with the consolidation work (same bucket-sync action).

### Recommendation

Bundle both into a single session titled "port infra consolidation" — the R2 bucket work only happens once (move to new account AND rename). Do it on a low-traffic evening with port users warned that uploads will be briefly unavailable during the sync cutover.

## Whirlpool actions — 2026-04-22 (w.v x press play)
- [ ] **garrett + team** — review and refine the w.v x press play proposal document as shared alignment tool for both teams
- [ ] **payton** — develop marketing materials hitting pain points ("have you ever felt disconnected at a conference?"), with digestible content + links to deeper pieces
- [ ] **garrett + press play** — explore co-branded social media posts combining Press Play event footage with Winded Vertigo research backing
- [ ] **both teams** — secure video documentation and testimonials at future events in real-time (not after the fact)
- [ ] **garrett** — explore design solutions for gathering engagement metrics at events (e.g., RFID badge tracking for play zone dwell time)
- [ ] **casper (press play)** — pursue Hotel Legoland + Danish conference hotel union organizer connections
- [ ] **garrett** — follow up with Paul Ramchandani on Pedal conference proposal (sent over holiday, no response yet)
- [ ] **press play** — add assets and documentation to the shared Google Drive folder
- [ ] **garrett + payton** — build co-branded landing page for w.v x press play conference injection offering; point campaigns to it
- [ ] **payton** — start drafting first campaign; prepare draft campaign + co-branded website for review at next w.v x press play whirlpool (May 11)

## Whirlpool actions — 2026-04-20 (writer's room)
- [ ] **Jamie** — split the "unfolding" document into 5 digestible Substack posts by end of day Tuesday (Apr 21)
- [ ] **Team** — review Jamie's unfolding document and flag particularly resonant sections
- [ ] **garrett** — discuss with Maria about designing interactive experiences and video content for Substack
- [ ] **Payton** — coordinate posting Jamie's content on Substack, LinkedIn, and website
- [ ] **Team** — plan structure for monthly public play dates (30–60 minutes: 20 min playing, 20 min reflecting, 20 min connecting to theory)
- [ ] **garrett** — use Claude to generate a 500-word summary of the transformative theory of change

## Whirlpool actions — 2026-04-15 (harbour playtest + strategy sprint)
- [ ] **garrett** — send cold outreach campaign to remaining organisations after meeting
- [ ] **team** — hold writing retreat on monday (apr 21) focused on "play, aliveness, justice" substack piece
- [ ] **payton** — create miro board with topics and angles before monday's writing retreat
- [ ] **garrett** — move play date booking interface to "the port" with pre-meeting questions ("what made you book?" / "i'd love to talk about…")
- [ ] **garrett** — pilot 2–4 harbour games per category; deprioritise breadth in favour of quality
- [ ] **team** — research play therapists as target audience (UK play therapy association as potential partner)
- [ ] **team** — use one harbour game as opener for future whirlpool meetings (cycle through raft house categories over 10–12 sessions)

## Whirlpool actions — 2026-04-13 (the world prowl — play session)
*This session was a dedicated sandbox/play experience. No new business action items. All April 8 items carry forward to Wednesday's whirlpool (Apr 15).*

## Whirlpool actions — 2026-04-08 (w.v x press.play)
- [ ] **garrett** — set up google drive folder and share with press play team
- [ ] **team** — upload documentation of past conference experiences to shared folder
- [ ] **team** — organize documentation into buckets/categories (small engagements → full conferences)
- [ ] **garrett** — draft doc proposing service tiers for conference offerings
- [ ] **press play** — translate danish testimonials to english
- [ ] **garrett** — schedule next w.v x press play for april 22, same time
- [ ] **garrett** — set up email chain or slack channel for ongoing press play comms
- [ ] **team** — follow up on cold email outreach responses and refine approach

## Active

### Urgent — deploy to CF Workers
- [x] ~~**Redeploy site to Cloudflare Workers**~~ (2026-05-01) — `wv-site` redeployed. `windedvertigo.com/tools/ppcs-launch` → 200. systems-thinking redirect live. Commit `350c772` + site session commits.

### Infrastructure follow-ups (post 2026-04-25 consolidation)
- [ ] **Notion content work — page covers** — Add page covers to playdates/packs/collections in Notion (creaseworks side, ~85 pages).
- [ ] **Phase 1 refactor for creaseworks** — Apply same read-time URL pattern as vault (compute from R2 key on read).
- [ ] **Phase 3: body-content image sync** — In vault and creaseworks, parse `body_html` and sync inline images to R2.
- [ ] **Revoke temp CF API token** — "Edit Cloudflare Workers" token, after stable.
- [ ] **Delete DNS API token** — `(cfut_H1x9...903e3, redacted — token literal in CF dashboard)`, after stable.
- [ ] **Close anotheroption CF account** — empty after migration.
- [x] ~~**Documentation sync**~~ (2026-04-25) — TASKS.md updated to reflect 2026-04-25 work.

- [ ] **IDB Salvador documentation — April 10 deadline** — Submit to nadia.nochez@mined.gob.sv as single consolidated digital file.
  - **Legal docs (Garrett to pull):**
    - [ ] Articles of Incorporation / Certificate of Formation for WV LLC
    - [ ] Legal representative credential registered with Commercial Registry
    - [ ] Photocopy of Garrett's ID
    - [ ] EIN / Tax Registry document
  - **Project references — READY:**
    - [x] PPCS / PRME — Signed contract amendment in Google Drive
    - [x] Superskills! / LEGO — Contract + invoicing in Google Drive
  - **Project references — NEED FROM COLLECTIVE:**
    - [ ] Autism Education Trust (UK Dept of Education) — ask collective member who led this
    - [ ] ECO966 / CONOCER / DIF (Mexico) — ask collective member who led this
    - [ ] Solihull Inclusive Education Strategy — ask collective member who led this
    - [ ] NSIT / New School for Neurodiversity (Japan) — ask collective member who led this
  - **Assembly:**
    - [ ] Compile all docs into single consolidated PDF
    - [ ] Draft signed cover note to Director of Public Procurement
    - [ ] Final review with Maria before submission
- [x] ~~**PRME 2026 contract** — Signed. Approved PO received Thu Mar 27. First invoice submitted same day.~~ (2026-03-27)
- [ ] **Amna at 10 proposal** — Follow up on submission (sent Mar 26 to Jonelle and Walaa)
- [ ] **401k / CPA coordination** — Finalize TPA arrangement for final 5500 + year-end testing with ADP (Alyssa Wong)
- [ ] **Website feedback** — 2 responses collected via #website-feedback (both flag newcomer discoverability). Scope "what we do" clarity improvement → log for Claude Code.
- [ ] **Sesame Workshop close-out** — Received pass 31 March. Draft graceful close-out reply.
- [ ] **Amna at 10 follow-up** — 8 days since proposal submission (26 March). Send follow-up to Jonelle and Walaa.
- [ ] **Whirlpool promotion** — Post teaser for 06 April session on LinkedIn/Bluesky
- [ ] **Resend webhook registration** — Register webhook URL + set RESEND_WEBHOOK_SECRET in Resend dashboard to unblock campaign tracking
- [ ] **Attio CRM trial** — Trial ending. Decide: keep or cancel.
- [ ] **Populate financial memory** — Share CPA info, bank details, annual revenue targets, expense budget with Claude to complete financial.md

## Waiting On
- [ ] **Collective members — IDB project docs** — Requests sent for AET, ECO966, Solihull, NSIT references — since (today)
- [ ] **Amna proposal response** — Submitted to Jonelle and Walaa — since Mar 26
- [ ] **Website feedback** — Circulated to trusted contacts — since Mar 27

## Engineering (Claude Code)

### PRs pending Garrett merge (2026-05-01 — plan reconfigured)

> Full reconfigured plan: `~/.claude/plans/graceful-popping-willow.md`
> Monitor running: task `bo2te4fe8` watches #20/#21/#22 (wv-port) + #25 (monorepo) for merge

**wv-port (`ghandoff/wv-port`) — merge in order:**
- PR #20 `feat/rfp-proposals-supabase-atomic-v2` — Phase G.1 complete: all list-GET routes → Supabase + atomic proposal claim ✅ green
- PR #21 `feat/campaign-weekly-analytics` — weekly pulse summary card on /campaigns ✅ green
- PR #22 `feat/agent-write-tools-v2` — createCampaign + updateContact agent write tools ✅ green
- ~~PR #19~~ closed ✓ | ~~PR #17~~ closed ✓ | ~~PR #14~~ closed ✓

**Monorepo (`ghandoff/windedvertigo`) — merge in order:**
1. PR #25 `restructure/phase-a1-cleanup-and-ops-merge` — Phase E.2+E.3: `@windedvertigo/email-templates` + `@windedvertigo/notion-crm` ✅ green
2. PR #26 `feat/ops-marketing-module` — CMO marketing module (base: PR #25) ✅ green
3. PR #28 `feat/booking-package-e4-clean` — Phase E.4: `@windedvertigo/booking` (base: PR #25) ✅ green
4. PR #30 `feat/systems-thinking-portfolio` — systems-thinking simulator + teacher guides ✅ green
5. PR #16, #17, #13 — lines-become-loops fixes + ops Supabase wiring (any order) ✅ green
6. ~~PR #29~~ — **close** (superseded by direct main commit beefb4f)
7. ~~PR #9~~ — **close** (stale draft, security audit reversal)
- ~~PR #27~~ closed ✓ | ~~PR #14~~ closed ✓

### After PRs merge — autonomous (Claude Code)

- [ ] **Site CF Workers redeploy** — after PR #25 merges: `cd site && npx opennextjs-cloudflare build && wrangler deploy`
  (PPCS launch countdown tool + systems-thinking redirect need this deploy)
- [x] ~~**Phase A.2: port nested-clone resolution**~~ (2026-05-01) — `port/.git` dissolved; archive ref pushed to `wv-port-archive`; `gh repo archive ghandoff/wv-port` complete.
- [ ] **Vercel project cleanup** — delete ~22 dormant projects after Garrett confirms list (see plan file)
- [x] ~~**Phase G.2.1: port → CF Workers (OpenNext)**~~ (2026-05-01) — `wv-port.windedvertigo.workers.dev` live; middleware.ts naming fix; wrangler.jsonc with queue producer bindings + hourly cron.
- [x] ~~**Phase G.2.2: Inngest functions → CF Queue consumers (port-jobs)**~~ (2026-05-01) — `port-jobs/src/index.ts` implements proposalConsumer, proposalDlqConsumer, timesheetConsumer, rfpDocumentConsumer. `seedProcessEnv()` bridge pattern. Native R2 binding for rfp-document consumer.
- [x] ~~**Phase G.2.3: Inngest send() → CF Queues dual-dispatch (all 6 call sites)**~~ (2026-05-01) — All 6 inngest.send() replaced with `publishJob()` + `getCloudflareContext()` in port API routes. `port/lib/cf-env.ts` augments `CloudflareEnv` global. CF canary confirmed live with all 3 queue producer bindings. commit `14f5a71`.
- [ ] **Phase G.2.4: 7-day parity canary** — started 2026-05-01. Compare `wv-port.windedvertigo.workers.dev` vs Vercel prod. Ends ~2026-05-08. After: G.2.5 DNS cutover.
  - **`wv-port-jobs` deploy (Garrett action needed)**: Run `cd port-jobs && bash deploy.sh` to provision 7 secrets + deploy CF Queue consumer. Script is safe — secrets piped directly into wrangler, never printed to stdout. Queues have 1 message each from G.2.3 testing that will process immediately on deploy.
  - Bugs fixed pre-deploy: R2_PUBLIC_URL was pointing at `creaseworks-evidence` bucket instead of `port-assets` (commit `57267e8`). Now reads from `wrangler.jsonc [vars]` with correct domain `pub-ae6933715be744649a1f2fd99346225a.r2.dev`.
  - G.2.5 cutover runbook: `port/G2.5-CUTOVER.md` (commit `a82b156`)
- [ ] **Phase B: harbour-apps subtree merge** — BLOCKED: 7 open PRs in harbour-apps (gate requires 0). Close stale PRs then re-run Phase 0 check.

### PRs opened this session (2026-05-01 hardening pass)

> All 4 PRs are independent of each other and can be merged in any order.
> PRs #31 + #32 are security/correctness fixes — merge before the others.

- [ ] **PR #31** `fix/ops-supabase-lazy-init` — ops: lazy-initialize Supabase client (prevented wv-ops preview build crash on missing env vars)
- [ ] **PR #32** `fix/ops-middleware-rename` — **security**: `ops/proxy.ts` → `middleware.ts`, export `middleware()` — auth guard was never running; all ops routes were unprotected
- [ ] **PR #33** `chore/gitignore-supabase-temp` — add `**/supabase/.temp/` to `.gitignore` (removes noisy untracked dirs)
- [ ] **PR #25** `restructure/phase-a1-cleanup-and-ops-merge` — E.2+E.3 shared packages (conflicts resolved, now mergeable) — triggers PRs #26→#28→#30→#16/#17/#13 chain

### Vercel cleanup — pending Garrett confirmation

~22 dormant Vercel projects identified. Full list in `~/.claude/plans/graceful-popping-willow.md` under "Vercel project cleanup". Projects that are safe to delete are all now live on CF Workers. Key ones: `harbour`, `depth-chart`, `harbour-apps`, `wv-crm`, `port`, `systems-thinking`, and 16 individual harbour app projects.

**Confirm these are OK to delete, then Claude Code handles the rest.**

### CRM — Phase 1: Data Visibility (this week)
- [x] ~~**Aggregate campaign dashboard**~~ (2026-03-29) — Stats strip on `/campaigns`: active / total, emails sent, avg open rate, avg click rate.
- [x] ~~**Resend webhook → Notion sync**~~ (2026-03-29) — Route was implemented but blocked by middleware (returning 401). Fixed public allowlist. **Still needed:** register webhook URL + `RESEND_WEBHOOK_SECRET` in Resend dashboard.

### CRM — Phase 2: Relationship Depth (next sprint)
- [x] ~~**Deal / opportunity pipeline**~~ (2026-03-29) — Kanban `/deals` (5 stages). Notion DB created. Drag-and-drop. Full CRUD API. Sidebar nav added.
- [x] ~~**Per-contact activity timeline**~~ (2026-03-29) — ActivityTimeline + LogActivityDialog wired into org detail page `/organizations/[id]`.
- [x] ~~**Won/lost reason capture**~~ (2026-03-29) — LostReasonModal in DealKanban intercepts drag to "lost", captures reason + notes before PATCH.

### CRM — Phase 3: Intelligent Outreach (after campaign data)
- [x] ~~**Email reply detection + sequence auto-pause**~~ (2026-03-29) — `lib/gmail.ts` + `api/cron/sync-replies` polls Gmail daily at 8:55am, writes "email received" Activities. Campaign cron filters replied orgs before each send. Gmail OAuth set up for garrett@windedvertigo.com; all 3 env vars live in Vercel production.
- [x] ~~**Sequence step scheduling**~~ (2026-03-29) — `api/cron/campaigns` runs daily at 9:07am (was incorrectly hourly — fixed). Evaluates `sendDate` or `campaignStart + cumulativeDelayDays` per step. Auto-marks campaign complete when all steps sent/skipped.

### CMO / Marketing Infrastructure (NEW)
- [x] ~~**Ops dashboard: marketing module**~~ (2026-05-01) — content calendar, campaign metrics, pipeline widgets in `ops/app/marketing/page.tsx`. PR #26 pending merge.
- [x] ~~**CRM: content drafting workspace**~~ (2026-04-30) — `/content` route live; merged to wv-port main in `cf4056b`. Uses Notion contentCalendar DB (env-var driven).
- [x] ~~**CRM: campaign analytics enhancement**~~ (2026-05-01) — weekly pulse card on `/campaigns` (this week vs last week deltas). PR #21 pending merge.
- [ ] **Notion: create content calendar DB** — properties: title, channel, body, scheduled date, status, author ← **Cowork action**: create DB + set `NOTION_CONTENT_CALENDAR_DB_ID` in wv-port Vercel env
- [x] ~~**KV keys for marketing data**~~ (2026-05-01) — `marketing:campaign-metrics`, `marketing:pipeline-summary` in `ops/app/api/marketing/route.ts`. PR #26.
- [x] ~~**TypeScript types for MarketingSnapshot**~~ (2026-05-01) — `ContentItem`, `CampaignMetrics`, `PipelineSummary` in `ops/lib/types.ts`. PR #26.
- [x] ~~**Nav updates**~~ (2026-05-01) — ops: marketing tab in DashboardShell (PR #26). CRM: "content" nav item in `app/components/nav-config.ts` (merged in cf4056b).

### raft.house — Next Waves
- [x] ~~**Wave 1: core platform**~~ (2026-03-31) — PartyKit server, 4 activity types (poll, prediction, reflection, open-response), facilitator dashboard, participant mobile view, join flow, timer, pause/resume
- [x] ~~**Wave 2: puzzle + asymmetric activities**~~ (2026-03-31) — Collaborative sequencing puzzles, asymmetric info role-play. 2 whirlpool session templates (play as pedagogy, sunk cost trap)
- [x] ~~**Deploy + CMS**~~ (2026-03-31) — Live at windedvertigo.com/harbour/raft-house. Notion sessions database. QR code sharing. ISR facilitate page.
- [x] ~~**Wave 3: canvas + sorting + rule-sandbox**~~ (2026-03-31) — Canvas (spatial pin placement with zones/axes), sorting (card categorization with solution scoring), rule-sandbox (parameter sliders + safe arithmetic evaluator). "Systems thinking" demo template.
- [x] ~~**Session results export**~~ (2026-03-31) — Markdown report with per-activity responses, poll tallies, prediction scoring, puzzle sequence comparison. Browser-side Blob download.
- [x] ~~**WebSocket reconnect fix**~~ (2026-03-31) — Exponential backoff (1s → 16s, 10 max attempts), connectTrigger state counter, visual reconnecting/failed states.
- [x] ~~**Custom session builder**~~ (2026-03-31) — Facilitator designs activity sequences from scratch with config editors for all 9 activity types. Replaces "coming soon" placeholder.
- [x] ~~**Session history**~~ (2026-03-31) — Auto-saves completed sessions to Notion "session results" DB. Facilitator can browse past sessions at /facilitate/history and view detailed results.

### Ops / Infrastructure
- [ ] **Verify ops OAuth flow** — Garrett: visit ops.windedvertigo.com incognito → should redirect to /login → SSO → dashboard with sign-out button. **(Gate: PR #32 must be merged + Vercel redeployed first.)**
- [ ] **Neon decommission** — Ancestry Neon project safe to delete after 2026-05-04 (7-day clean window). `DATABASE_URL` in ancestry/.env.local already updated; just delete the Neon project.
- [ ] **wv-nordic JWT rotation** — Supabase dashboard → wv-nordic → API Settings → "Generate new JWT secret". Then re-pull new keys to nordic/.env.local (see plan Thread 2).
- [x] ~~**Ancestry → Supabase migration**~~ (2026-04-27) — 20 tables + data migrated from Neon to wv-port-pilot. postgres.js driver wired. Deployed to wv-ancestry on Vercel.
- [x] ~~**ops team members from Supabase**~~ (2026-04-27) — ops_team_members table live; team panel reads from Supabase with static fallback. Also ops_projects seeded + Supabase fallback for projects panel.
- [x] ~~**Set up Cloudflare KV for ops data**~~ — KV wired: API routes read from KV with static fallback, POST /api/kv for dispatch writes (2026-03-29)
- [x] ~~**Connect wv-ops to GitHub**~~ — Auto-deploy: `ghandoff/windedvertigo` → rootDirectory `ops/` (2026-03-29)
- [x] ~~**Ops dashboard: project tracker**~~ — Notion integration fetches from shared projects DB with static fallback (2026-03-29)
- [x] ~~**Set env vars on Vercel for ops**~~ (2026-03-29) — All 10 env vars set including CLOUDFLARE_API_TOKEN. Redeployed.
- [ ] **Wire QuickBooks into ops dashboard** — Cowork dispatch task pushes P&L, cash flow, invoices to KV → ops reads from KV (Cowork task)
- [ ] **Wire Gusto into ops dashboard** — Cowork dispatch task pushes payroll, team, contractor data to KV (Cowork task)
- [x] ~~**Shared auth package**~~ (2026-03-29) — Extracted to `packages/auth`. CRM + ops re-export from `@windedvertigo/auth`.
- [x] ~~**Middleware → proxy migration**~~ (2026-05-01) — `ops/proxy.ts` → `ops/middleware.ts`, export renamed to `middleware()`. PR #32. Auth guard was dead before this fix.

## Someday
- [x] ~~**Monthly close scheduled task**~~ (2026-03-29) — Runs 1st of month 9am ET. Pulls P&L + cash flow from QuickBooks, pushes to ops KV.
- [x] ~~**Weekly ops review task**~~ (2026-03-29) — Runs Sundays 6pm ET. Full operational review: finance, projects, calendar, team → pushes all data to ops KV + Slack summary.
- [x] ~~**Daily briefing task**~~ (2026-03-29) — Runs weekdays 8am ET. Calendar, priorities, deadlines, overnight emails → Slack DM.
- [x] ~~**Meeting prep automation**~~ (2026-03-29) — Runs weekdays 7:30am ET. Gathers context for each meeting: recent emails, Notion notes, CRM history → Slack DM.
- [ ] **CRM build-out** — Expand package builder and client relationship tracking
- [x] ~~**Quarterly strategic review**~~ (2026-03-29) — Runs first Monday of Jan/Apr/Jul/Oct at 10am ET. Full portfolio review: financials, projects, pipeline, team, next-quarter priorities.

## Done
- [x] ~~Ops auth fix + design system + API routes~~ (2026-03-28) — Auth was broken because static page bypassed middleware. Converted to server component with auth gate. Added sign-out, user email, dynamic date. Imported shared tokens. Created 6 API routes. Deployed.
- [x] ~~Second brain architecture — CLAUDE.md, memory/, TASKS.md built~~ (2026-03-28)

## Whirlpool actions — 2026-04-27

- [ ] **Payton** — connect with Jamie today/tomorrow re: facilitation guide structure + deadlines
- [ ] **Team (each member)** — write one paragraph on how Maria's work has personally inspired you (for Wed celebration)
- [ ] **Payton** — prepare Wednesday whirlpool agenda + lead the meeting (Garrett at UC-Riverside PD panel)
- [ ] **Team** — draft introductory Substack post explaining transformative theory of change in plain ("4th-grade") language
- [ ] **Payton** — set hard deadlines for Substack post submissions
- [ ] **Garrett + Maria** — finalize Thursday's PPCS Session 1 immediately after this whirlpool (anchor-leg prep at 10:30am)

*Recording + summary:* https://www.notion.so/34fe4ee74ba48019a809c50a4eba95ee
*Agenda:* https://www.notion.so/34fe4ee74ba481478f90c28141029068

## Whirlpool actions — 2026-06-10

- [ ] **Garrett** — share all transformative theory of change + PPCS report documents into the prime internal Slack channel for team access
- [ ] **Garrett** — schedule a session to set up the GitHub repo and clone shared folders for the team (onboard Jamie + Lamis into the Claude co-work environment)
- [ ] **Garrett** — allocate time next meeting for a deep dive into Jamie's transformative theory of change document
- [ ] **Garrett** — book a 1-hour meeting with Lamis to finalise the Crease Works launch
- [ ] **Jamie** — draft the transformative theory of change document and integrate it into Creaseworks
- [ ] **Jamie** — revise the framing document to align with the transformative theory of change
- [ ] **Jamie** — draft a wv manifesto on harbour game design
- [ ] **Jamie** — create operational checklists derived from the TToC document to serve as a project filtering ("rag rate") mechanism
- [ ] **Jamie** — address evidence gathering + impact assessment within the Creaseworks documentation (narrative-based evidence)
- [ ] **Jamie + Lamis** — share GitHub account names with Garrett so he can add them to the winded.vertigo workspace
- [ ] **Payton** — review materials for the 5 selected activities and dial in the iconography for each
- [ ] **Payton** — ask PaM to move the UN International Day of Play social posts into "in progress"
- [ ] **cARL** — conduct a literature review on popular/effective classroom games to identify potential competition
- [ ] **the group** — create a Crease Works project roadmap integrating the co-design model + 3-layer (collect & connect) framework
- [ ] **the group** — recruit children + educators from networks for user testing / feedback sessions
- [ ] **the group** — finalise the top 3 Crease Works activities to initiate community testing
- [ ] **the group** — develop a 'mini' (curated, facilitated) version of Crease Works aligned with the TToC

*Recording + summary:* https://docs.google.com/document/d/1glIv9O_NfSFNJw19tU6gZSJqCC2AWYqwTKB1YIp3ars
*Agenda:* https://www.notion.so/37be4ee74ba4813f83e2e8c4fa84374c
