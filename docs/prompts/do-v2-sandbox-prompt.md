# prompt: build the /do/v2 sandbox (three variants, public URLs)

Copy everything below this line into a fresh Claude Code session opened at `~/Projects/windedvertigo`.

---

We're prototyping the next version of windedvertigo.com/do — moving from a grid-of-assets portfolio to a families-of-services experience. Your job, in three strict phases: **(0) critique the design plan, (1) plan the build in plan mode, (2) build** three distinct, working prototype variants of the new /do page and get them onto **public URLs** the collective can open on their phones and evaluate side by side. This is a sandbox: production must not change.

## phase 0 — be critical first (before any planning or code)

Read the documents below, then give the design plan a hard, honest critique BEFORE proposing how to build it. Do not be polite about it; be useful. Specifically:

- **Steelman the opposite:** the strongest case that the current grid is fine, that the mixing desk is a gimmick, that three variants is one too many, or that the plan's cleverness serves the studio's ego more than the visitor's task.
- **Attack the weak joints:** the fader axes are placeholder abstractions — do they mean anything to a MEL lead on a phone? Is the "matching…" beat honest or theatre? Does the ticker risk exactly the typewriter mistake the team already identified? Where does the plan contradict its own research (e.g. interaction cost, choice overload, NN/g findings it cites)?
- **Check feasibility against this repo:** anything in the plan that is unrealistic for a static-prototype sandbox, conflicts with CLAUDE.md conventions, or hides a maintenance trap.
- **Name what's missing:** states the plan never designed (empty/loading/error, returning visitors, direct-to-family deep links from campaigns, non-English visitors, screen-reader narrative order), and any brand-guideline conflict.
- End the critique with: (a) the 3–5 changes you would make to the plan, (b) what you'd cut if you could only ship ONE variant, (c) open questions only the team can answer. **Stop and present this critique for my response before entering plan mode.** I may accept adjustments or overrule you — the critique gets a reply before any code exists.

## phase 1 — plan mode

Only after the critique conversation: enter plan mode and propose the concrete build plan (file structure, shared data shape, deploy target, order of work, what gets cut per the accepted critique). Get approval, then build.

## read these first (in the repo, committed)

1. `docs/do-v2/design-plan.md` — the full design plan. Read it end to end before the phase-0 critique. It contains the design thesis ("the controls are the portfolio"), Mo's marketing angle, the research constraints, the five concepts, the recommended composition, the behavioral map, the a11y/AEO requirements, and the slop do-not list. Treat it as the spec.
2. `docs/do-v2/profiles-problems-proof.md` — the content map: 5 visitor profiles, 7 service families, ~31 problem hook-lines, proof strips. This is the copy source of truth.
3. `docs/do-v2/profiles-problems-rubric.md` — background on the profiles (fuller descriptions, archetypes).
4. `CLAUDE.md` + `site/styles/tokens.css` — repo conventions and the canonical design tokens. Brand shorthand: champagne `#ffebd2` fields, cadet blue `#273248` ink, redwood `#b15043` primary accent, burnt sienna `#cb7858` secondary; Inter; **all UI copy lowercase**; british spelling; brand name always `winded.vertigo`.

## the three variants (baseline spec — subject to the accepted phase-0 critique)

All three render the same content data (build one shared JSON from the content map — `families[7]` each with `slug`, `name`, `hooks[]`, `plain-words offer`, `proof[]`, and `profiles[5]` each with `id`, `firstPersonLine`, `familyWeights`). Same data, three different experiences:

**variant a — "the quiet index."** The pure typographic spine. Problem-ticker hero (one hook-line at a time, large type, tap to jump; pauses on hover; honours reduced-motion; full static list available). Below: seven lowercase family rows as a semantic list; tap a row and it *unfolds* in place (accordion) into hooks → offer in ≤3 plain sentences → proof strip → next-step ladder (play → take → talk). Two plain text browse axes at top: *browse by what you need / browse by who you are*. No cards, no chips, no grid. Radical restraint; ships fast; this is the control condition.

**variant b — "faders over filters."** The recommended composition from the design plan. Everything in variant a PLUS the mixing desk: a compact tactile panel with the five profile preset buttons (first-person lines) and 3 faders (label them `people ↔ systems`, `evidence ↔ play`, `learn ↔ build` — flagged in the plan as placeholders, make them easy to rename). Moving anything live-reweights and reorders the family index (visible ~300ms "matching…" beat, skippable). Desk state serialises to the URL (`?p=p1&f1=30&f2=70…`) so a mix is shareable and deep-linkable. Faders implement the ARIA slider pattern, arrow-key operable, ≥24px touch targets, snap points on mobile. The fader is the page's ONLY physical metaphor — everything else stays quiet.

**variant c — "what brings you here?"** The dialogue-led playful variant. Entry is a scripted three-beat exchange in large type: beat 1 — five first-person situation lines (the profiles); beat 2 — that profile's 3–4 problem hooks ("yeah, this one's me"); beat 3 — the page folds itself: matched families rise already-unfolded with a matched proof artifact and CTA. Every beat shows *skip — just show me everything* which drops to the full index (variant a's spine). Art-directed and charming, NOT a chatbot, no free-text field. Progress shown as a notch filling along a crease. After the reveal, the visitor's "mix" is a small shareable artifact (URL state).

Shared across all three: mobile-first (design at 375px first); no scrolljacking; every interactive element keyboard-operable; `prefers-reduced-motion` + a visible "plain version" toggle that renders the entire page as its static semantic layer; all hooks/families/proof server-rendered in the initial HTML (progressive enhancement only on top — AI crawlers don't run JS); a `llms.txt` at the sandbox root; footer proof floor with wordmark names (LEGO Foundation, UN Global Compact/PRME, Amna, Nordic Naturals) presented straight — no marquee, no animation. Consult the slop do-not list in the design plan §3 and violate none of it: no pill-filter rows, no card grids, no gradient halos, no glassmorphism, no hover-lift shadows, no pulsing dots.

## delivery: public URLs, zero production risk

- Build as **static prototypes** (plain HTML/CSS/JS or a minimal build — no framework needed; each variant one self-contained page + shared data/css) in a new top-level `do-v2-sandbox/` directory in this repo.
- Deploy as a **dedicated Cloudflare Worker with static assets** (wrangler is already configured in this repo; `CLOUDFLARE_API_TOKEN` is available per `site/.env` conventions) to a `workers.dev` URL — e.g. `wv-do-v2.<account>.workers.dev`. Do NOT touch the `wv-site` worker, its routes, or anything in `site/` — production stays untouched. If a workers.dev deploy is blocked for any reason, fall back to Cloudflare Pages; same rule: no production routes.
- Structure: `/` = an index page listing the three variants with one-line descriptions and the evaluation questions below; `/a`, `/b`, `/c` = the variants. Add `?plain=1` support on each as the plain-version entry.
- The index page should ask evaluators (the collective) these questions, visibly: which entry made you *feel* the problem-first idea? could you find "your" problem in under 30 seconds? did the desk feel like play or like work? on your phone, which variant would you send to a client? where did you want a next step that wasn't there?

## working conventions (from CLAUDE.md — follow them)

- Start with `git pull --rebase origin main`; work on `feat/do-v2-sandbox`; end by committing + pushing (solo merge: `gh pr merge --admin --squash --delete-branch`).
- Kebab-case files; commits `feat(do-v2): …`.
- When done, print: the public URL(s), what you built per variant, any places you deviated from the design plan and why, and the open questions you hit (fader axis names, proof artifacts that need public-link clearance, copy that needs the team's voice pass).

## quality bar

This sandbox is itself an audition of the thesis — a learning-design studio whose /do page *demonstrates* playful, evidence-disciplined interaction. If a variant feels like a template, it has failed; if it's clever but a keyboard user or a screen reader can't traverse it, it has failed harder. Craft the microinteractions (fader detents, unfold ease, ticker rhythm) like they're the portfolio — because per the design plan, they are.
