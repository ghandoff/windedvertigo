# windedvertigo.com/do — design plan
### from grid-of-assets to families-of-services

*Prepared 23 july 2026. Inputs: the profiles × problems × proof map (§1.3b of the strategy doc), the Jul 22 FruitStand transcripts, Mo's marketing memory, cARL-grade research (sources throughout), the brand guidelines (18 feb 2025), and a broad design survey of what to avoid and what to steal.*

---

## 0 · the one-line design thesis

**the controls are the portfolio.** A learning-design studio that sells playful, evidence-disciplined experiences should prove it in the first ten seconds of the /do page — not by decorating a grid, but by making the act of navigating feel like the thing we sell. A quiet typographic index of the seven families, reconfigured live by one lovingly-crafted analog control, entered through problems (not nouns), with proof presented dead straight underneath.

The page's journey IS the brand line: **find → fold → unfold → find again.**
find (a problem that names you) → fold (shape the page to your situation) → unfold (a family opens with proof) → find again (a next step that brings you back).

---

## 1 · mo's marketing angle

From Mo's working memory and strategy (rocket-fuel synthesis, competitor scans, blind-spot log):

1. **We sell to early-majority pragmatists — proof first, vision second.** The page must convert existing wins (PPCS, Amna, Nordic, the port) into visible reference proof. Every family unfold ends in a shipped artifact, not a promise. Per the Boompop competitor finding: *borrow the craft (clean premium layout, bold stat blocks), not the substance* — our stat blocks carry outcomes (710 certificates, 68 countries, £20k/6-week evidence maps), a lane every scanned competitor leaves empty.
2. **Market the machinery, not the slogan.** "We don't overclaim" only holds as differentiation if the site shows the receipts: the coding console, the public evidence maps, the live PPCS dashboard, the PaM dashboard. The /do page should link to *working things*, which is also the strongest expression of "we run ourselves on agents."
3. **Reframe the AI window.** Mo's falsification pass: ~92% of orgs have *adopted* AI; few get value. So family 2's hooks sell **operationalisation** ("you have ChatGPT; you don't have a system"), not adoption urgency.
4. **Stop hiding the legacy.** Mo's standing note: LEGO Foundation, United Nations/PRME, 19 publications belong up front. Proof layer uses wordmark logos (per Fruit: logos are immediate — "you don't have to read"), presented straight, ustwo-style.
5. **Focus the firepower.** The falsification pass warns 7 families × 6 humans risks marketing breadth over depth. Design consequence: all seven families are *present and equal in the index*, but the funded families (evidence, AI platforms, PD) get the deepest unfolds, the freshest proof, and the hook-copy testing budget. The page structure hides this prioritisation gracefully — nothing looks like a stub.
6. **The page is a hub, not an island.** Every campaign artifact (evidence-posts, reels, conference QRs) lands on a family unfold with the matching hook pre-selected — the mechanics below support deep-linking any profile × family state.

---

## 2 · what the research says (cARL digest)

Full citations in §9. The findings that discipline the design:

- **Audience-first navigation is a documented anti-pattern** (NN/g): people can't or won't self-identify, and gating content behind "I am a…" creates anxiety and pogo-sticking. **Families are the primary structure; the five profiles are a lens, never a wall.**
- **Problem-recognition entry is the evidence-aligned version of segmentation**: task-based, not identity-based — which is exactly Fruit's "are you bloated all the time?" insight, and sidesteps NN/g's objection.
- **Seven choices won't overload anyone if differentiation is easy** (Scheibehenne / Chernev meta-analyses: overload appears with high complexity + preference uncertainty, not with count). One sharp problem-line per family kills the uncertainty. The "7±2" rule is folklore; ignore it.
- **Guided flows need escape hatches**: visible steps, back, skip, and an always-present "just show me everything." A chooser is an offer, never a gate (NN/g wizards).
- **Behavioral spine, ethically applied** (primary sources): curiosity gap (Loewenstein) — tease specifics you actually deliver; labor illusion (Buell & Norton) — show the matching work; IKEA effect (Norton/Mochon/Ariely) — let visitors *build* their view; goal gradient + endowed progress (Kivetz; Nunes & Drèze) — start the journey pre-advanced; micro-yeses (Freedman & Fraser) — hook click → mix → unfold → low-stakes CTA. The dark-pattern line (Mathur et al.): no covertness, no fake urgency, transparent skip.
- **Social proof: few, specific, role-relevant; never counts that read small** (NN/g).
- **No scrolljacking; mobile first; every custom control fully keyboard-operable** (NN/g; WCAG 2.2 — SC 2.5.7 drag alternatives, SC 2.5.8 24px targets, ARIA slider pattern).
- **AI crawlers don't run JavaScript.** GPTBot/ClaudeBot/PerplexityBot read raw HTML. The problem statements are precisely what answer engines should quote when someone asks an LLM "who can build me an evidence map in weeks?" — so every hook, family, and proof line ships as server-rendered semantic HTML; the play is progressive enhancement on top. Plus llms.txt.
- **Forget classical A/B at our traffic.** ~250 conversions per variant needed; we won't have it. Use radical-redesign + micro-conversion trends + 5-user tests; a bandit only for hook-copy rotation.

---

## 3 · the slop we are explicitly not making

The generic 2026 pattern is now a *negative* signal (reads as template/AI output): a row of rounded pill filters over a masonry card grid, hero eyebrow chips, gradient halos, indigo/violet, glassmorphism, auto-scrolling logo marquees, pulsing status dots, hover-lift cards, "theater" copy. The impeccable.style slop catalog (64 tells) is our do-not list. Two ironies to hold:

- **Our brand typeface is Inter — which is also the slop default.** Fine: fonts don't make slop, layouts do. We keep Inter (it's ours, 147 languages, accessibility story) and let lowercase typography, colour, and the signature control carry distinctiveness.
- **The current /do page is already the slop pattern** (grid + filters) — which is exactly why friends said "just show us examples" and the quadrants got hidden. The meeting's fear — "are we just right back to being a grid with filters?" — is answered structurally below: the same seven-family data renders as *an index you play*, not a grid you filter.

---

## 4 · five concepts (the clever handful)

Each concept is viable alone; the recommendation (§5) composes them. All are lowercase, champagne-paper backgrounds, cadet-blue ink, redwood/burnt-sienna accents, Inter, mobile-first, reduced-motion-safe.

### concept 1 — the mixing desk *(faders, not filters)*
The meeting's slider idea, matured. A single tactile control panel — 3–4 chunky faders (e.g. *people ↔ systems*, *evidence ↔ play*, *learn ↔ build*) plus five preset buttons (the profiles, phrased as first-person lines: "i owe a funder an answer", "my team is drowning in ops"…). Moving anything **reweights and reorders the seven families live** — the index below visibly re-sorts, families swell or shrink, hook-lines swap to the ones matching your mix. It's a recipe, not a bucket: "we're not putting you into tidy boxes" made literal, the LEGO "sell perceptions, not bricks" line embodied.
*Why it's clever:* the design survey found **no canonical owner of this mechanic** — slider/knob interactions exist as scattered award-site moments, but a "mixing desk over a service index" is distinctive, on-trend with the tactile revival (Playdate/teenage engineering energy), and semantically it's still just filtering — so it degrades gracefully to buttons + a list for keyboard, screen readers, crawlers, and old phones.
*Risks:* touch precision (fat thumbs, snap points); must never be the only path; needs the ARIA slider pattern and visible value labels.

### concept 2 — the unfolding *(every family is a fold)*
The index rows behave like paper. Each family sits folded — one problem-line visible, a crease hinting at more. Tap and it *unfolds* in place: problems → the offer in plain words → proof artifacts → the next step. Fold one, another catches light. The whole page is a sheet being worked: find → fold → unfold → find again, and a quiet nod to creaseworks without naming it.
*Why it's clever:* the interaction *is* the brand arc; unfold animation is cheap (CSS transforms), accessible (it's an accordion underneath — a native disclosure pattern), and mobile-perfect (accordions beat grids on phones).
*Risks:* fold visuals must stay subtle or it becomes a gimmicky origami theme; one unfold open at a time to keep orientation.

### concept 3 — the quiet index *(confidence is a text list)*
The Bureau Mirko Borsche / Pentagram move: the /do page as a beautiful, fast, typographic index. Seven lowercase family lines, large; hover/tap reveals a floating collage of that family's artifacts; two honest browse axes exposed as plain text — *browse by what you need / browse by who you are*. No cards. No chips. Radical restraint as the anti-slop statement, and the cheapest option to ship.
*Why it's clever:* instant load, inherently accessible, inherently mobile, unmistakably confident; the strongest pure-minimalism reading of the brand.
*Risks:* restraint alone doesn't demonstrate "playful"; without a signature interaction it under-tells the interactivity story. (This concept is the *spine* the others decorate.)

### concept 4 — what brings you here? *(a scripted playdate, not a chatbot)*
An optional dialogue entry — three beats, art-directed, finite choices with charm (the me & oli / Lower Junction model; explicitly *not* a free-text LLM box, which is fast becoming its own slop). Beat 1: five first-person situation lines (the profiles). Beat 2: that profile's 3–4 problem hooks ("yeah, this one's me"). Beat 3: the page folds itself — matched families rise, a matched proof artifact and CTA appear — with a visible "skip this — show me everything" at every beat.
*Why it's clever:* it's the choose-your-own-adventure the team already believes in (the quadrants), rebuilt on problem-hooks instead of self-diagnosis, with the escape hatches research demands. Each beat is a micro-yes; completion hands the visitor a tiny built artifact (their "mix" — IKEA effect) they can share or return to (deep-linkable state).
*Risks:* must stay under ~20 seconds; copy is everything; never gate.

### concept 5 — the problem ticker *(hooks before nouns)*
The hero mechanic. Before any service is named, the page deals problem-lines — one at a time, large type, drawn from the 31-row problems column: "a funder just asked 'does this work?'" … "your smartest people are doing data entry" … Visitors can let them rotate or flick through; grabbing one (tap) is the endowed first step — the page scrolls you to the matching family, already unfolded, chooser pre-advanced. The wink lives here: most lines are plain-spoken; every profile gets one nerd-wink line only their sector would catch.
*Why it's clever:* it operationalises the meeting's entire "present the problem" epiphany in the first viewport; it's also the FOMO-reel format (each ticker line = one short-form video script = one LinkedIn hook — content engine and site share one spine); and each line is server-rendered quotable HTML for answer engines.
*Risks:* rotation must pause on hover/reduced-motion (the typewriter critique — "you have to sit and wait for the one you care about" — applies; so also render all lines as a static list below the fold or on interaction).

---

## 5 · recommended direction: *faders over filters* (a composition)

Compose, don't choose: **quiet index as the spine (C3), the mixing desk as the one signature control (C1), the ticker as the hero hook (C5), the scripted dialogue as the mobile/first-visit on-ramp (C4), and the unfold as the detail interaction (C2).** One physical metaphor rule (Playdate's crank discipline): the *fader* is the page's only toy; everything else is silent typography.

### page anatomy (top to bottom)

1. **hero — the problem ticker.** lowercase, huge, cadet blue on champagne. one problem-line at a time with a subtle fader-notch progress mark; tap = grab. beneath it, one quiet line: *"seven things we do. five kinds of people who need them. start with your problem."* and two plain links: *play the desk* · *just show me everything.*
2. **the desk.** the profile presets (five first-person buttons) + 3–4 faders in a single compact panel. moving anything live-reorders the index below with a brief, honest "matching…" beat (labor illusion, ≤400ms, skippable). the panel state serialises to the URL (shareable, campaign-linkable, returnable).
3. **the index.** seven family rows, big lowercase type, each: family name → its current best-matching problem-line (swaps with your mix) → a small proof tease (e.g. "710 certificates · 68 countries"). rows reorder/reweight by mix. this is a semantic `<ol>` — reorder is presentation only.
4. **the unfold (family detail, in place).** problems (that profile's set) → what we do about it, in ≤3 plain sentences → **proof strip**: 2–4 artifacts with thumbnails (evidence map, dashboard, simulator — live links to working things wherever possible) + one named, role-matched testimonial → **the next-step ladder** (see behavioral map). portfolio assets tag into multiple families (the Gmail-label/"Schrödinger's folder" decision) — same asset, different framing line per family.
5. **proof floor.** the legacy strip: wordmark logos (LEGO Foundation, UN Global Compact/PRME, Amna, Nordic…), straight, no marquee, no counts. one line: *"we've been doing this since before it was a website."* (or similar — Payton's "profesh" word-marks note.)
6. **the quiet exit.** for the visitor who read everything and clicked nothing: *"not sure which of these is you? bring us the problem — thirty minutes, no deck."* single CTA.

### mobile-first behavior
The dialogue (C4) *is* the mobile desk: presets as full-width tap targets, faders as horizontal snap-sliders sized ≥24px targets, index rows as native accordions. No hover-dependent content anywhere (hover previews get tap equivalents). No scrolljacking, period.

### brand application
- **colour:** champagne `#ffebd2` fields, cadet blue `#273248` ink, redwood `#b15043` for the active fader + grabbed hook, burnt sienna `#cb7858` for secondary accents; complementary palette only inside proof-artifact thumbnails. black never primary (brand rule). *Verify contrast:* cadet-on-champagne passes comfortably; redwood-on-champagne is for large type/controls only — run WCAG checks at build.
- **type:** Inter; Light/Bold sparingly for hierarchy (brand rule: subhead ≤50% of headline ascender). all lowercase except proper identities.
- **voice:** playful. human. dynamic. — "creative but not frivolous." hooks commiserate ("yeah, this part sucks" energy, house-trained); the claim boundary holds everywhere (conditions and documentation, never child outcomes).
- **motion:** every animation meaningful, ≤400ms, honoring `prefers-reduced-motion` and the site's existing stop-animations toggle — accessibility toggles remain a brand feature, extended to the desk (a "plain version" switch that renders the whole page as its static semantic layer — the a11y fallback, the crawler layer, and the minimalist flex are one artifact).

### the wink & the dark-logic valve
Each profile's hook-set carries exactly one insider line (the Pixar layer). The general lines keep the door open for the less-cool-but-paying visitor; qualification happens in conversation, not at the door (the meeting's "dark logic"). CIA two-nugget rule: the desk shows *your problem* and *our proof* side by side and lets the visitor connect them — the page never says "so you need us."

---

## 6 · behavioral design map (principle → mechanism → ethics check)

| principle (source) | mechanism on the page | ethics check |
| --- | --- | --- |
| curiosity gap (Loewenstein) | ticker teases a specific problem; unfold *answers it* with a real artifact | never tease what we don't deliver; no clickbait gaps |
| problem-recognition (the Fruit doctrine) | hooks in visitor language, one per row, before any service noun | hooks name real problems we actually solve |
| micro-yeses (Freedman & Fraser) | grab a hook → set a preset → unfold a family → one low-stakes CTA | each step skippable; "show me everything" always visible |
| endowed progress (Nunes & Drèze) | arriving via a campaign link or grabbing a hook pre-sets the desk — step 1 is already done | pre-set state is visible and changeable, not hidden |
| goal gradient (Kivetz) | the dialogue is 3 beats with a visible notch filling; payoff is the built mix | 3 real beats, no fake steps |
| IKEA effect (Norton et al.) | the visitor's mix is a thing they made — shareable URL, "save your mix" | their artifact, no forced email to see it |
| labor illusion (Buell & Norton) | brief "matching your situation…" beat before re-sort | ≤400ms, honest (it *is* matching), skippable |
| social proof (NN/g) | few, named, role-matched testimonials per family; logo strip; no counts | real names/roles with permission; small numbers never shown |
| customization over personalization (NN/g) | the *visitor* moves the faders; the site never silently reshapes itself | no covert AI personalization — trust is the product |
| CTA ladder (interaction-cost logic) | per profile: **play** (harbour tool / simulator / evidence map) → **take** (the matched artifact/report) → **talk** (book a 30-min "playdate", not a "sales call") | ladder ordered by commitment; talk never pushed first |

The CTA ladder is the "moving them toward engaging, not constantly moving them" requirement made concrete: passive → player → collector → conversation, each rung optional, each rung measured.

---

## 7 · content, SEO & answer-engine layer

- **Server-render everything that matters**: all 31 problem-lines, 7 family descriptions, proof entries — real HTML in the initial payload; desk and unfolds are progressive enhancement. (AI crawlers — GPTBot, ClaudeBot, PerplexityBot — do not execute JavaScript.)
- **The problem-lines are the AEO inventory**: they are near-verbatim what a buyer types into an LLM before knowing we exist. Mark the problems + our answers up FAQ-style per family; ship llms.txt; keep each family at a stable, crawlable URL (`/do/evidence`, `/do/platforms`…) that is also the deep-link target for desk states.
- **Heat-cable rule (Fruit's client)**: hook copy uses *their* words, not ours — "prove our program works" not "MEL"; the wink line is where the jargon lives, on purpose. Validate hook phrasing against real search/LLM queries quarterly.
- **One spine, many surfaces**: ticker lines = reel scripts = LinkedIn hooks = newsletter subject lines. The content engine and the page draw from the same problems table (§1.3b) so testing anywhere improves everywhere.

## 8 · measurement & validation (no vanity, no fake certainty)

- **Micro-conversion events**: hook grabs (by line), desk interactions (preset/fader, by profile), dialogue starts/completions/skips, family unfolds (by family × profile), proof-artifact clicks, ladder clicks by rung (play/take/talk), mix-URL shares, plain-version toggles. Wire through Vercel analytics + custom events; feed the port so Mo's Friday scorecard can carry a real funnel (and finally instrument harbour's tool→list→opp path).
- **Testing at our traffic**: no classical A/B (we'd need ~250 conversions/variant). Instead: 5-user moderated tests on the desk + dialogue before launch (can the visitor find their problem in <30s? do they understand the faders?), before/after micro-conversion trends vs the current grid, and a simple bandit rotating hook-copy variants in the ticker only.
- **Success definition (90 days)**: ticker-grab rate, ≥1 unfold per session median, ladder engagement per profile, and — the number that matters — qualified conversations opened attributable to /do deep-links. Guardrail: claim-boundary violations shipped = 0; accessibility toggles usage monitored, never degraded.

## 9 · build path & open questions

**Path**: (1) copy lock — hooks per profile per family from §1.3b, wink lines drafted with the team (this is the Friday-meeting material); (2) static spine — quiet index + unfolds + proof floor, fully semantic, shippable on its own as do-do sandbox v2; (3) the desk — presets first, faders second; (4) dialogue on-ramp; (5) instrumentation + llms.txt; (6) 5-user test; launch keyed to the sept–oct /conferences + /do relaunch window in Mo's calendar.

**Open questions for the team**: (a) fader axes — *people↔systems / evidence↔play / learn↔build* are placeholders; pick 3 the team would defend; (b) does the desk metaphor render as literal faders or the more abstract "notches on a crease" (hourglass-not-digital-clock argument cuts both ways); (c) which working artifacts are cleared to link publicly (Amna map? PaM dashboard view?) — proof strips depend on it; (d) does /quadrants retire, or become one preset ("i don't know what my problem is yet") that launches the dialogue?

---

## sources

**internal**: strategy doc §1.3b (profiles × problems × proof) · FruitStand transcripts 22 jul (Gemini + Notion) · Mo memory (rocket-fuel synthesis; Boompop + conference-competitor scans; falsification pass; blind-spots log) · brand guidelines 18 feb 2025 · windedvertigo.com (live).

**research** (key external): NN/g — [audience-based navigation](https://www.nngroup.com/articles/audience-based-navigation/) · [mega menus](https://www.nngroup.com/articles/mega-menus-work-well/) · [wizards](https://www.nngroup.com/articles/wizards/) · [interaction cost](https://www.nngroup.com/articles/interaction-cost-definition/) · [scrolljacking](https://www.nngroup.com/articles/scrolljacking-101/) · [social proof](https://www.nngroup.com/articles/social-proof-ux/) · [customization vs personalization](https://www.nngroup.com/articles/customization-personalization/). Choice overload: [Scheibehenne et al. 2010](https://scheibehenne.com/ScheibehenneGreifenederTodd2010.pdf) · [Chernev et al. 2015](https://chernev.com/wp-content/uploads/2017/02/ChoiceOverload_JCP_2015.pdf). Behavioral: [Golman & Loewenstein](https://www.cmu.edu/dietrich/sds/docs/golman/golman_loewenstein_curiosity.pdf) · [Buell & Norton 2011](https://www.hbs.edu/ris/Publication%20Files/Norton_Michael_The%20labor%20illusion%20How%20operational_f4269b70-3732-4fc4-8113-72d0c47533e0.pdf) · [Norton, Mochon & Ariely 2012](https://myscp.onlinelibrary.wiley.com/doi/abs/10.1016/j.jcps.2011.08.002) · [Kivetz et al. 2006](https://home.uchicago.edu/ourminsky/Goal-Gradient_Illusionary_Goal_Progress.pdf) · [Nunes & Drèze 2006](https://www.researchgate.net/publication/23547282_The_Endowed_Progress_Effect_How_Artificial_Advancement_Increases_Effort) · [Freedman & Fraser 1966](https://web.mit.edu/curhan/www/docs/Articles/15341_Readings/Influence_Compliance/Freedman_Fraser_Foot-in-the-door.pdf) · [Mathur et al., CHI 2021 (dark patterns)](https://arxiv.org/pdf/2101.04843). Accessibility: [ARIA slider pattern](https://www.w3.org/WAI/ARIA/apg/patterns/slider/) · [WCAG 2.2 SC 2.5.7](https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements.html). Testing: [CXL low-traffic CRO](https://cxl.com/blog/how-to-do-conversion-optimization-with-very-little-traffic/) · [CXL bandits](https://cxl.com/blog/bandit-tests/). AEO: [do LLMs render JS](https://www.clickrank.ai/llms-render-javascript/) · [llms.txt](https://searchengineland.com/llms-txt-proposed-standard-453676). Design survey: [Boris Müller — visual weariness of the web](https://borism.medium.com/on-the-visual-weariness-of-the-web-8af1c969ce73) · [impeccable.style slop catalog](https://impeccable.style/slop/) · [Bureau Mirko Borsche via hoverstat.es](https://www.hoverstat.es/features/bureau-mirko-borsche/) · [Pentagram](https://www.pentagram.com/work) + [AREA 17 case study](https://area17.com/work/pentagram-website) · [me & oli](https://www.awwwards.com/sites/me-oli) · [Lower Junction](https://www.awwwards.com/sites/lower-junction-choose-your-own-adventure) · [Awwwards knob interactions](https://www.awwwards.com/inspiration/knob-interaction) · [Smashing — designing sliders](https://www.smashingmagazine.com/2017/07/designing-perfect-slider/) · [play.date](https://play.date/) · [teenage.engineering](https://teenage.engineering/) · [(not boring) software](https://notbor.ing/) · [ustwo](https://ustwo.com/) · [Locomotive](https://locomotive.ca/en) · [Lusion](https://lusion.co/) · [Figma 2026 web trends](https://www.figma.com/resource-library/web-design-trends/).
