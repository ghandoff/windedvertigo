# animation pipelines for creaseworks (and the wider harbour)

> research report · 2026-07-04 · prepared for garrett
> question: how do we produce children's-cartoon-style animated videos (marketing,
> tutorials, webinars) AND lightweight in-app/game animations that are robust,
> cool-looking, and small enough to embed — using Claude plus other tools, fitted
> to our stack (Next.js/React, Vercel + Cloudflare Workers, R2, planned Cloudflare
> Stream, Notion CMS, Claude-heavy workflow)?
>
> triggered by: [Jack Vs. AI — "How to Build a Kids Animation Channel with AI (Full Workflow)"](https://www.youtube.com/watch?v=NnvRMs_0UQ8)
> (published 2026-06-28). his current workflow: character/world design in Nano Banana Pro
> + GPT Image 2 → scene animation in Seedance 2.0 via Higgsfield → nursery-rhyme music
> in Suno → lip-sync in Seedance → scripting with Claude.
>
> method: 5 parallel research agents (AI video gen · character design/animation ·
> voice/music/kids-policy · code-based animation · runtime formats), ~90 sources,
> followed by an adversarial verification pass on the 10 highest-stakes claims
> against first-party sources. verified corrections are folded in below.

---

## the story first: what animation does for us

*for payton, maria, and the collective — the technical research follows, but start here.*

creaseworks teaches people to find, fold, unfold, and find again. right now the
platform says that in words and photographs. animation lets it *show* it — a fold
happening, a character discovering something, energy shifting in a room. for a
product whose whole thesis is playful, hands-on learning, motion isn't decoration;
it's the pedagogy made visible.

imagine four scenes, all reachable within a couple of months:

**a teacher lands on the sampler page.** a small hand-drawn-feeling guide character —
ours, designed once, owned forever — waves, folds a paper shape, and gestures toward
the matcher wizard. it reacts when she hovers. if she's turned on the calm theme,
it sits quietly as a still illustration instead. (this is a rive/lottie asset,
a few kilobytes, living in the app itself.)

**she opens a playdate and taps "watch how this runs."** a 90-second walkthrough
plays: our colours, our lowercase type, the steps animating in sequence, a warm
voice narrating. nobody filmed it — claude generated it from the same notion data
that builds the page, and it re-renders automatically when the playdate changes.
(this is the remotion pipeline.)

**payton posts a 40-second cartoon on the socials.** two recurring characters
discover that a failed fold is actually a new pattern — a tiny story about
creative confidence, in a children's-cartoon style that's unmistakably ours.
(this is the AI video pipeline: claude script → character sheets → seedance/veo →
elevenlabs voice → music.)

**a whirlpool opens with a 20-second animated sting.** same characters, same motion
language, bridging the community events, webinars, and the product into one
recognisable world.

one character bible, one motion kit, four surfaces. that's the vision: not "making
videos" as a side project, but a shared visual language that compounds — every asset
we make feeds the app, the marketing, the tutorials, and eventually the games.

## the plan: four weeks of playing, then launching

the tools below cost roughly $60–120/month all-in and none of them require
engineering to *try*. the plan is deliberately play-first: everyone gets hands on
tools in week one, we compare notes at fruitstands, and we only standardise after
we've seen real output against the brand.

**week 1 — accounts + first toys.**
- shared accounts to set up (garrett, since billing): google AI pro (~$20/mo, nano
  banana pro for character design), higgsfield starter ($15–39/mo, seedance 2.0),
  elevenlabs starter ($6/mo), suno pro ($10/mo) or artlist, rive free tier, and a
  lottielab free account. park credentials in the usual place.
- everyone's first exercise, no skill required: describe a guide character in
  words, generate it in nano banana pro, and try to get the *same* character in
  three different scenes. this teaches the core discipline (reference sheets beat
  clever prompting) faster than any tutorial.
- worth watching together: the [jack vs. AI workflow video](https://www.youtube.com/watch?v=NnvRMs_0UQ8)
  that sparked this — it's the exact pipeline we're piloting.

**week 2 — character bible + first motion.**
- pick 1–2 guide characters from week-one experiments; garrett + claude formalise
  turnaround sheets (front/side/back, expressions, style references) and commit them
  to the repo. this is the single most valuable asset in the whole plan.
- maria: rough a 60–90 second script for one real playdate walkthrough — what would
  a facilitator actually need to see? her ops/facilitation eye is the quality bar.
- payton: draft two social-length story beats (30–45s) for the characters, and a
  list of where they'd circulate (socials, newsletter, whirlpool invites).
- garrett + claude: build the motion kit in the repo (brand-tokened GSAP/motion
  micro-interactions, reduced-motion gating) — free, and immediately shippable
  in-app regardless of how the video pilots go.

**week 3 — three pilots in parallel.**
- pilot A (payton + garrett): one cartoon short via the higgsfield workflow, voiced
  in elevenlabs, scored with suno/artlist. target: good enough to post.
- pilot B (garrett + claude): one remotion walkthrough rendered from maria's script
  and real playdate data. target: compare honestly against the vault plan's
  $2.5–5k contracted-editing estimate.
- pilot C (garrett + claude, small): the guide character as an interactive rive
  mascot on the sampler page, wired to the calm-theme toggle.
- everyone keeps a running note of what felt easy, what fought back, and what
  looked off-brand.

**week 4 — review, decide, launch.**
- fruitstand review of all three pilots against three questions: does it look like
  us? what did it really cost in hours and dollars? which surface gets the most
  value soonest?
- standardise on two pipelines, log the decision in `docs/cmo/decisions-log.md`,
  and schedule the first public launches: walkthrough video in creaseworks, cartoon
  short on socials, mascot in-app.
- from there it's a rhythm, not a project: one walkthrough + one short per
  fortnight is sustainable at this budget.

two ground rules from the research worth carrying into every session: character
consistency comes from reference sheets and locked seeds, not model cleverness; and
all video for creaseworks self-hosts on our R2/stream — no youtube embeds on pages
kids touch (COPPA, §5 below).

---

## 1. the core framing: two different problems, two different pipelines

everything you want falls into one of two buckets, and the tools barely overlap:

| | **rendered video** (marketing, tutorials, webinar assets, youtube) | **runtime animation** (in-app, in-game, harbour UI) |
|---|---|---|
| deliverable | MP4/WebM file | Lottie/Rive/code that renders live |
| file size reality | 4–30 MB per minute | 5–200 KB per asset |
| where it lives | R2 or Cloudflare Stream | bundled with the app / R2 + CDN |
| who "makes" it | AI video models + editing | Claude writes it as code, or an editor exports it |
| interactivity | none | full (state machines, react to user input) |

the biggest single insight from this research: **for the runtime bucket, Claude can
author most of it directly as code** (GSAP, Motion, CSS/SVG, Remotion, Phaser), and
that path is nearly free, fully owned, tiny in file size, and immune to the licensing
and consistency problems that plague AI video. AI video generation is the right tool
only for the narrative cartoon videos.

---

## 2. recommended pipelines by use case

### 2a. narrative kids-cartoon videos (marketing, vibe, story content)

**recommended stack (the 2026 creator consensus, verified):**

1. **script** — Claude (you already live here)
2. **character + world design** — Google **Nano Banana Pro** (Gemini 3 Pro Image):
   up to 14 reference images, holds up to 5 characters consistent across scenes;
   widely regarded as the strongest consistency editor in 2026. API ~$0.13–0.24/image;
   consumer via Google AI Pro (~$20/mo). build proper character turnaround sheets
   (front/side/back + expressions) once, reuse forever. alternative: Midjourney V7
   omni-reference (`--oref`) if you prefer its aesthetics ($10–30/mo).
3. **animation** — **ByteDance Seedance 2.0** (what Jack Vs. AI uses, via
   [Higgsfield](https://higgsfield.ai)): accepts up to 9 reference images + 3 video
   + 3 audio clips per generation, multi-shot with locked characters, native synced
   audio, up to 2K. third-party API rates ~$0.04–0.05/sec. runner-up: **Google Veo 3.1
   + Flow** ("ingredients to video" locks characters with 3 reference images, clips
   extendable to a minute+; API $0.10–0.40/sec; full Veo needs Google AI Ultra —
   restructured May 2026 to $99.99/$199.99 tiers, Pro at $19.99 only gets Veo Lite).
   best-value stylised option: **Hailuo 2.3** (explicitly tuned for anime/illustration
   looks, ~$10/mo entry).
4. **voice** — **ElevenLabs**: Voice Design v3 builds custom cartoon voices from a text
   description; dedicated character/animation voice library; commercial licence on any
   paid tier (Starter $6/mo; Creator $22/mo is the practical tier). free tier is
   non-commercial.
5. **music** — **Suno Pro** ($10/mo, commercial rights) — legally much safer since the
   WMG settlement (nov 2025), though Sony/UMG litigation continues; for zero legal
   ambiguity in a paid education product, license from **Artlist** (~$10–17/mo, covers
   apps + monetised video) or **Epidemic Sound** (~$9–19/mo). note: **Udio is currently
   unusable** (downloads disabled during its walled-garden relaunch).
6. **edit** — CapCut / DaVinci Resolve (free), or Adobe Express if we lean on the
   Adobe MCP already connected in Cowork.

**budget:** ~$50–150/mo for the full stack at hobby-to-pilot volume. Higgsfield
Starter/Plus $15–39/mo; credits expire monthly, so batch production into bursts.

**what to avoid (verified):**
- **Sora — dead.** consumer app discontinued 2026-04-26; Sora 2 API shuts down
  2026-09-24. do not build anything on it.
- **Luma Ray3.14** dropped character reference — wrong tool for a recurring cast.
- long continuous shots. AI motion still gets floaty; the pros cut every 4–8 seconds,
  music-video pacing, and do lip-sync as a separate pass.

**the discipline that matters more than the tool:** character consistency comes from
reference sheets + locked seeds/refs, not from the model being clever. one character
bible per character, versioned in the repo (or Notion), fed into every generation.

### 2b. tutorial / instructional videos (creaseworks vault walkthroughs)

this connects directly to the existing **vault video walkthrough plan** (march 2026
draft: 50+ videos, 3–8 min, Cloudflare Stream). two viable modes:

- **hybrid human mode (the existing plan)** — facilitator + screen recording. still the
  right call for authenticity with educators; AI cartoon inserts can top-and-tail these
  (animated intro sting, cartoon "creaseworks guide" character introducing the activity).
- **claude-authored motion graphics mode — the sleeper option: [Remotion](https://remotion.dev).**
  videos are React/TSX code; every frame is a React render. Remotion ships an official
  LLM system prompt, an MCP server (`@remotion/mcp`), and Claude Code skills — it is the
  best-documented LLM→video pipeline that exists. Claude writes the tutorial video
  (brand colours, Inter type, lowercase copy, step-by-step motion graphics, even
  data-driven per-playdate videos generated from the Notion sync), renders locally or
  on Remotion Lambda for pennies ($0.02–0.10 per video, compute only).
  **licence (verified):** free for companies up to 3 people; at 4+ people it's $25/seat/mo
  (Creators) or $0.01/render with $100/mo minimum if we automate rendering inside a
  product. check headcount interpretation before productising.

  this mode is a genuine strategic fit: template once, then *generate a walkthrough
  video per playdate programmatically* — the kind of scale the vault plan costs at
  $2.5–5k of contracted editing.

**delivery:** short, known-length tutorial content encoded well doesn't need Stream's
ABR. cartoon/flat content at 1080p compresses to roughly 15–30 MB/min (H.264),
7–12 MB/min (VP9), 4–8 MB/min (AV1) — estimates, run a test encode with
`ffmpeg -c:v libsvtav1`. **R2 with zero egress makes self-hosting near-free** (one case
study: 15 TB served for ~$2). keep Cloudflare Stream ($5/1,000 min stored +
$1/1,000 min delivered, verified) for longer or adaptive-bitrate content. this also
sidesteps the COPPA problems of youtube embeds (see §5).

### 2c. in-app + in-game animations (creaseworks UI, browser games, harbour)

this is where "cool looking, robust, yet not too large" actually gets solved, and
almost none of it needs AI video tools:

**tier 1 — Claude writes it as code (default, free, tiny):**
- **CSS/SVG/Web Animations API** — zero dependencies, zero licence, Claude is extremely
  reliable at this. covers 60% of UI delight.
- **GSAP** — now **100% free including all plugins** (SplitText, MorphSVG, etc.) since
  the Webflow acquisition (verified, gsap.com/blog/3-13). ships official AI skills for
  coding agents ([greensock/gsap-skills](https://github.com/greensock/gsap-skills)).
  the workhorse for anything complex on the sites.
- **Motion** (framer-motion successor, motion.dev) — MIT core, first-class React, has
  an AI kit + examples MCP. natural fit for creaseworks' React 19 components.
- **anime.js v4** — MIT, ~10 KB gz, lovely for micro-interactions.

**tier 2 — designed character/mascot animations:**
- **Rive** — the standout for a "creaseworks guide" character that reacts to users:
  state machines + data binding (live app data drives the animation), binary `.riv`
  files roughly 10× smaller than equivalent Lottie when built natively (267 KB lottie
  → 16 KB riv example from the Rive CEO). **runtimes are MIT, no runtime fees ever;
  editor is free to create, $9/mo (annual) to ship** (verified oct 2025 pricing).
  game-UI runtimes exist too. caveat: `.riv` files are made in a GUI editor — Claude
  wires up the runtime and (new) writes Luau scripts via Rive's AI coding agent, but
  can't author the asset as text.
- **Lottie / dotLottie** — the pragmatic path when motion designers (or LottieFiles'
  AI tools) make assets: After Effects + Bodymovin (free) or **LottieLab** (free tier;
  pro $12/mo; "magic animator" AI) or **LottieFiles** (~$20/mo, motion copilot AI,
  MCP integration with Claude). use `.lottie` (50–80% smaller than raw JSON) and the
  dotlottie-web player. performance pitfalls are real: avoid masks/mattes, embedded
  rasters, and many simultaneous SVG-renderer instances (documented memory blowups).
- pixel-art / sprite direction: **sprite sheets** via TexturePacker ($55 perpetual,
  free tier for small shops) + animated **WebP/AVIF** (AVIF ≈ 3–10% of GIF size, full
  alpha support) for decorative loops.

**tier 3 — browser games:**
- **Phaser 4** (MIT, released april 2026, WebGL node renderer, ~1M sprites/draw call)
  for actual game loops; **PixiJS v8** (MIT, WebGPU) for custom canvas scenes; Rive
  for game UI overlays. skip Spine unless we get serious (per-developer editor licence
  $69–299 + enterprise threshold at $500k revenue).
- transparent-video trick for "cartoon character walks across the page": WebM VP9+alpha
  (chrome/firefox) + HEVC+alpha fallback (safari) — same clip measured at 1.1 MB vs
  3.4 MB; or Jake Archibald's stacked-alpha AV1 approach (460 KB).

**accessibility (non-negotiable for our calm theme):** respect
`prefers-reduced-motion` everywhere — static poster + explicit play control instead of
autoplay; and WCAG 2.2.2 requires pause/stop/hide controls on anything auto-moving
longer than 5 s *regardless* of the user's motion preference. creaseworks' existing
motion-reduction setting should gate every Lottie/Rive/video autoplay. Lottie and Rive
both support reduced-motion patterns; this is a differentiator for us, not a chore.

### 2d. webinar + presentation assets

lowest-effort wins: Remotion or GSAP-animated HTML slides (Claude-authored, brand-true),
Lottie stickers/loops exported from the same asset library as the app, plus short
Seedance/Veo cartoon clips as openers. one shared "creaseworks motion kit" (characters,
colours, transitions) feeds app, webinars, and videos — build it once.

---

## 3. how it fits the winded.vertigo stack

- **claude-heavy shop → lean into code-first animation.** Remotion (official MCP +
  skills), GSAP (official skills), Motion (AI kit + MCP), LottieFiles (MCP) all
  explicitly target Claude/agent workflows now. our comparative advantage is that
  Claude Code sessions can produce, review, and version animation as PRs in the
  monorepo — same git workflow, same conventions, no binary blobs except `.riv`/`.lottie`.
- **R2 already in place** → self-host tutorial MP4/WebM (zero egress) under the
  existing `/creaseworks/` bucket convention; Stream reserved for long-form/ABR.
  keep `/harbour/*` pages free of per-request server inputs when adding video pages
  (the ISR/edge-caching rule in CLAUDE.md applies to media pages too).
- **notion CMS sync** → store per-playdate video URLs + poster frames exactly like
  cover images today; a Remotion pipeline could even render per-playdate videos from
  the same synced data.
- **calm theme + a11y prefs** → gate all motion behind the existing preference;
  reduced-motion variants ship with each asset.
- **games + harbour** → Phaser 4/PixiJS/Rive assets live in `site/public/tools/{name}/`
  per the existing HTML-tools convention; Lottie/`.riv` assets can be served from
  site/public or R2.
- **brand** — lowercase, cadet blue #273248, redwood #b15043, Inter: encode these into
  the motion kit + the Claude system prompts for Remotion/GSAP work, and into the
  character bible for AI video generation (style reference images).

---

## 4. cost summary (verified where marked ✓)

| item | cost | notes |
|---|---|---|
| GSAP, Motion, anime.js, CSS, Phaser, PixiJS | $0 ✓ | GSAP fully free incl. plugins |
| Remotion | $0 now ✓ | free ≤3-person companies; $25/seat/mo or $100/mo min if we grow/automate |
| Rive | $9/mo ✓ | to ship; runtimes MIT, no per-asset fees |
| LottieLab or LottieFiles | $0–20/mo | AI-assisted lottie authoring |
| Nano Banana Pro (images) | ~$20/mo or ~$0.13–0.24/img API ✓ | character design |
| Higgsfield (Seedance 2.0) | $15–39/mo | credits expire monthly — batch work |
| Veo 3.1 (if chosen) | $99.99–199.99/mo Ultra ✓, or API $0.10–0.40/s ✓ | Pro tier only gets Veo Lite |
| ElevenLabs | $6–22/mo ✓ | commercial licence from first paid tier |
| Suno Pro | $10/mo ✓ | commercial rights; or Artlist/Epidemic ~$10–19/mo |
| Cloudflare Stream | $5/1k min stored + $1/1k min delivered ✓ | R2 self-hosting near-free alternative |
| **pilot total** | **~$60–120/mo** | video-gen tools dominate; runtime animation ≈ free |

---

## 5. risks + compliance

1. **youtube is purging "AI slop".** the july 2025 "inauthentic content" policy is
   actively demonetising mass-produced AI kids channels in 2026 (several large channels
   removed; figures are single-source but directional). our posture: low-volume,
   genuinely original, human-edited, Claude-scripted content is fine — a
   volume-automation kids channel is not a business we should build.
2. **COPPA got stricter.** amended rule fully in force since 2026-04-22: opt-in
   parental consent for third-party data sharing, voice counts as biometric personal
   information, mandatory retention limits. schools may still consent on parents'
   behalf for education-only use (FTC declined edtech carve-out changes but kept the
   guidance). **practical rule: self-host video on R2/Stream inside creaseworks; do
   not embed youtube iframes on child-directed pages** (even youtube-nocookie writes
   identifiers). never record children's voices without the full consent apparatus.
3. **AI-content licensing.** all major video models grant commercial use on paid tiers
   (Kling from $6.99 Standard ✓, Runway/Pika/Hailuo on paid plans), but purely
   AI-generated output may not be copyrightable (US Copyright Office position) — our
   moat is the characters, scripts, and brand, which are human-authored and protectable.
   Firefly remains the lowest-risk image option (licensed training data) if a client
   context demands it.
4. **tool volatility is the norm.** Sora died in six months; Udio froze downloads;
   Adobe tried to kill Animate (feb 2026, reversed to maintenance mode); Luma dropped
   character reference. mitigation: keep the durable assets (character bibles, scripts,
   voice designs, motion kit code) in the repo, treat any given video model as a
   swappable commodity.
5. **remotion licence threshold** — recheck the 3-person definition against how the
   collective is structured before making Remotion rendering a product feature.

---

## 6. suggested next steps (pilot plan)

1. **build the creaseworks motion kit first** (1–2 claude code sessions, ~$0):
   brand-tokened GSAP/Motion micro-interactions + 3–5 Lottie/CSS loops + reduced-motion
   gating pattern. immediate payoff in-app regardless of video decisions.
2. **character bible sprint**: design 1–2 "creaseworks guide" characters in Nano Banana
   Pro (turnarounds, expressions, style refs), versioned in the repo. this asset feeds
   every downstream pipeline.
3. **one pilot cartoon video** (~$50 of credits): Jack Vs. AI workflow — Claude script →
   Nano Banana Pro scenes → Seedance 2.0 on Higgsfield → ElevenLabs voice → Suno/Artlist
   music → CapCut edit. judge quality honestly against the brand.
4. **one Remotion tutorial-video prototype**: template a vault walkthrough
   (intro sting → steps → outro) rendered from playdate data; compare cost/quality
   against the contracted-editing estimate in the vault plan.
5. **one Rive experiment** ($9/mo): the guide character as an interactive state-machine
   mascot on the creaseworks sampler page, wired to the calm-theme toggle.
6. decide after the pilots which two pipelines to standardise; write the choice into
   `docs/cmo/decisions-log.md`.

---

## appendix: key sources

first-party / verified: [Sora discontinuation (OpenAI help)](https://help.openai.com/en/articles/20001152-what-to-know-about-the-sora-discontinuation) · [Remotion licence](https://www.remotion.dev/docs/license) + [pricing](https://www.remotion.pro/license) · [Remotion AI docs/MCP](https://www.remotion.dev/docs/ai/) · [Rive pricing](https://rive.app/pricing) + [MIT runtime](https://github.com/rive-app/rive-runtime/blob/main/LICENSE) · [GSAP free announcement](https://gsap.com/blog/3-13/) · [ElevenLabs pricing](https://elevenlabs.io/pricing) · [Suno pricing](https://suno.com/pricing) · [Gemini subscriptions](https://gemini.google/subscriptions/) + [Veo API pricing](https://ai.google.dev/gemini-api/docs/pricing) · [Seedance 2.0](https://seed.bytedance.com/en/seedance2_0) · [Higgsfield](https://higgsfield.ai/seedance/2.0) · [Cloudflare Stream pricing](https://developers.cloudflare.com/stream/pricing/) · [R2 pricing](https://developers.cloudflare.com/r2/pricing/) · [Nano Banana Pro](https://blog.google/innovation-and-ai/products/nano-banana-pro/) · [Midjourney omni-reference](https://docs.midjourney.com/hc/en-us/articles/36285124473997-Omni-Reference) · [amended COPPA rule (federal register)](https://www.federalregister.gov/documents/2025/04/22/2025-05904/childrens-online-privacy-protection-rule) · [youtube inauthentic-content policy](https://support.google.com/youtube/answer/1311392?hl=en) · [Phaser 4](https://phaser.io/phaser4) · [dotLottie](https://dotlottie.io/) · [LottieFiles AI](https://lottiefiles.com/ai) · [WMG–Suno settlement (MBW)](https://www.musicbusinessworldwide.com/warner-music-group-settles-with-suno-strikes-first-of-its-kind-deal-with-ai-song-generator/) · [Adobe Animate reversal (TechCrunch)](https://techcrunch.com/2026/02/04/after-backlash-adobe-cancels-adobe-animate-shutdown-and-puts-app-on-maintenance-mode/) · [transparent video (Jake Archibald)](https://jakearchibald.com/2024/video-with-transparency/) · [LottieFiles WCAG guide](https://developers.lottiefiles.com/docs/resources/wcag/)

secondary (directional, verify before spending): Higgsfield/Kling/Hailuo/Runway pricing aggregators (eesel, magichour, costgoat), youtube-crackdown figures (outlierkit, scalelab), cartoon-content encoding estimates (computed, not benchmarked).
