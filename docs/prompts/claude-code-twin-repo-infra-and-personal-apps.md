# Claude Code prompt — twin-repo shared infra + hobbies/ tier (get a second opinion before planning)

Paste everything below into a Claude Code session opened at `/Users/garrettjaeger/Projects` (needs to reach both `windedvertigo/` and `harbour-apps/`).

---

## Context

winded.vertigo runs two deliberately separate repos: `windedvertigo/` (the consulting/design-services arm — site, internal CRM "port", ops dashboard) and `harbour-apps/` (the commercial games/interactive-apps arm — ~25 Cloudflare Worker apps, expected to keep growing for years). That split is confirmed correct — it matches the actual business model (project-based consulting vs. a freemium/subscription product suite) per internal Notion docs. What's missing is the connective tissue: right now, "shared" concerns between the two repos are either duplicated with drift (two incompatible `@windedvertigo/auth` implementations) or solved by wholesale-copying one repo into the other (`windedvertigo/apps/harbour` is a full duplicate checkout of `harbour-apps`, 1,720 files, already stale).

A full architecture audit was already done — **read `/Users/garrettjaeger/Projects/architecture-audit-2026-07-06.md` in full before doing anything else.** It has file-level evidence for every claim below, plus an addendum covering the business-alignment research and an Ancestry deep-dive. Don't skip it and don't take my summary below as a substitute for it.

## Your job, in this order — do not skip the critique step

1. **Read the audit doc + addendum in full.**
2. **Independently re-verify the highest-stakes claims against the live repos before trusting them.** The audit was done from a sandboxed research environment and explicitly flagged some things as unverifiable from local files alone — e.g., which Supabase project (`wv-port-pilot` vs `wv-booking`) is actually live where, whether anything still deploys from `windedvertigo/apps/harbour`, and whether `apps/creaseworks`'s Vercel-vs-Cloudflare status is genuinely unresolved. You have a real shell and can check actual deploy hooks, git remotes, and running infra — use that advantage.
3. **Critique the plan below.** This is the point of routing this to you — poke holes in it, flag anything wrong, riskier than it looks, sequenced badly, or missing entirely. Don't defer to my ordering just because it's written down.
4. **Only after that: enter plan mode** with your own refined version, phased, with an explicit approval gate before anything that touches live auth, a database, or a production deploy.
5. **Do not execute anything this session.** Critique and planning only, until I explicitly approve moving to execution — and even then, expect to come back for approval between phases, not run the whole thing end to end.

## What's already decided (sanity-check it, but don't relitigate it from scratch)

- Keep `windedvertigo` and `harbour-apps` as separate repos.
- Build real cross-repo package sharing instead of duplicating — starting with `auth` and `tokens`, since those are the two the business model requires to be consistent (the Harbour launch plan promises "one sign-on" across the main site and every Harbour app, plus shared branding).
- Rotate the exposed secret at `windedvertigo/port/.vercel/.env.production.local.bak.20260527T055148` — do this regardless of everything else, it doesn't wait on the rest of the plan.

## Open questions your plan needs to resolve

1. **Shared-package mechanism.** Leading option from the audit: private versioned npm packages (GitHub Packages or a private npm org) that both repos install as normal dependencies. Confirm that's the right fit given harbour-apps already uses Turborepo, or propose something better (git submodule pointing at a small `wv-shared` repo, npm workspace `file:` linking) if you find one once you're actually in the repos.

2. **The `@windedvertigo/auth` naming collision.** `windedvertigo/packages/auth` (minimal NextAuth config, ~157 lines) and `harbour-apps/packages/auth` (~1,800-line SSO/nav-widget system used across ~20 apps) both publish under the identical package name. Resolve the collision (rename one or both) and propose a migration path for consumers — one app at a time, with a deploy + smoke test between each, never a global rename in one shot.

3. **The `windedvertigo/apps/harbour` mirror.** Confirm nothing live actually depends on this duplicate checkout before touching it, then archive it (not a hard delete) — consistent with this workspace's existing `_loose-archive-2026-06/` convention.

4. **New `hobbies/` tier.** I've built a couple of things purely for myself/family, on hobby timelines, and they shouldn't live inside either business repo:
   - **`windedvertigo/ancestry`** — a real small multi-user genealogy app (family trees, GEDCOM export, FamilySearch import, AI-assisted hints). Zero monetization, no strategy doc anywhere treating it as a line of business. It's currently coupled to business infrastructure in ways that need to be undone regardless of where it ends up: `packages/auth` has a hardcoded `tree_members` bypass built specifically for it, and its database has lived unprefixed inside the same Supabase project as `port`'s CRM data since an April migration. Decouple its auth (pull the bypass out of the shared package) and give it its own database before or as part of relocating it.
   - **`amy-messages`** (currently loose at the top level of `/Projects`) — a private encrypted family message archive. No business relevance at all.
   - There may be more of these over time — flag anything else you notice that looks like a personal project living inside a business repo, and ask me before assuming.
   - Proposed structure to evaluate: a new top-level folder, `/Users/garrettjaeger/Projects/hobbies/`, sibling to `windedvertigo/` and `harbour-apps/`, where each hobby app is its own small, fully self-contained project — no shared business packages, no Turborepo, deployed however's simplest and cheapest. This is hobby-pace development, not something that needs business SLAs or shared infra. Confirm this makes sense once you've actually looked at what Ancestry needs to run standalone, and propose adjustments if a different shape fits better.

5. **Everything else from the original audit** — design-token drift between the two `tokens` packages, duplicated hand-rolled Neon DB clients and Stripe clients across ~6 harbour-apps, the Vertigo Vault image duplication, the mismatched Supabase `config.toml` label, and leftover Vercel debris — sequence these as later, lower-urgency phases. None of them block the twin-repo infra work or the personal-apps move.

## Constraints

- `creaseworks` and `vertigo-vault` have live paying customers. Any change touching auth, database, or deploy config for apps in that path needs a rollback plan and a real deploy + smoke test before the next step, not a batch of changes pushed together.
- Archive rather than hard-delete anything you're not fully certain is dead.
- One package or one app at a time — no global renames or big-bang migrations across every consumer simultaneously.

## Deliverable for this session

A written, phased plan (presented in plan mode for my approval) that reflects your own live verification and honest critique of everything above — not just a restatement of the phases as I've listed them here. If you disagree with the ordering, the mechanism choice, or the personal-apps structure, say so and propose better.
