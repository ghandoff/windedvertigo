# winded.vertigo — Brand Guidelines

*Single source of truth for visual identity across all apps and touchpoints. Derived from the official brand identity guidelines (18 february 2025), co-created by aaron fruit (director of aesthetics) and garrett jaeger (founder and director).*

*Source PDFs are on the shared drive under `resources/comms ops/`. This file captures the rules relevant to digital product development. Refer to the PDFs for print-specific guidance and full visual examples.*

---

## Brand Name

- **Full**: winded.vertigo (always lowercase, period separator)
- **Abbreviation**: w.v (with period — used when space or context requires it)
- **Code shorthand**: wv (used in CSS variables, file prefixes, package scoping)
- **Never**: Winded Vertigo, WindedVertigo, winded vertigo, Winded.Vertigo, W.V

The period is a core identity element — a nod to early internet domain conventions (.com, .org, .edu) where the suffix indicated what kind of service you belonged to. winded.vertigo's period signifies the collective is "at service to vertigo" — the state of uncertainty that prepares us to let go and flow ahead.

## Mission

winded.vertigo transforms education through playful, innovative learning experiences that nurture human development and interconnectedness. The collective co-creates impactful learning ecosystems that thrive on diversity, support lifelong growth, and enable communities to evolve together.

## Tagline

**learning is change.** — wv designs the conditions that help people and institutions move toward uncertainty with curiosity and agency.

## Core Values

Three interconnected values guide everything wv does. They are not separate — together, they shape how change becomes possible across people, systems, and the infrastructures that shape them.

| Value | Definition |
|-------|-----------|
| **Play** | Protected experimentation — creating space to test ideas and discover new possibilities |
| **Justice** | Structural transformation — aligning power, resources, and decision-making for equitable, sustainable change |
| **Aliveness** | The lived experience of curiosity and connection that emerges when systems support meaningful participation |

How they reinforce each other:
- **Justice** creates the security and shared agency that make experimentation possible
- **Play** enables adaptation without burnout
- **Aliveness** signals change that is regenerative rather than extractive

## Methodology — Find, Fold, Unfold, Find Again

wv's service delivery follows a four-phase cycle:

| Phase | Action | Activities |
|-------|--------|-----------|
| **Find** | Notice what is already present | Listening sessions, qualitative inquiry, skills mapping |
| **Fold** | Shape insight into experiment | Programme design, facilitated learning, toolkits |
| **Unfold** | Reflect and surface what changed | Evaluation, MEL frameworks, impact studies |
| **Find Again** | Carry learning forward so it travels | Capability building, system refinement, scaling |

The cycle is designed so learning adapts, travels, and continues taking root beyond the initial engagement.

## Verbal Identity

Three pillars define how winded.vertigo communicates: **playful**, **human**, and **dynamic**. Each pillar has boundaries to prevent the tone from drifting.

### Playful

Curiosity, exploration, and creativity drive how wv approaches learning and growth. The brand invites the world to play and discover alongside it.

| We are | But not |
|--------|---------|
| Creative | Frivolous |
| Lighthearted | Careless |
| Curious | Aimless |

### Human

The collective is about connecting and bringing people together. The voice is warm, relatable, and driven by empathy — speaking to the heart, not just the mind.

| We are | But not |
|--------|---------|
| Authentic | Contrived |
| Empathetic | Impersonal |
| Approachable | Condescending |

### Dynamic

Change excites wv. The brand embraces transformation and agility, constantly evolving with the world around it.

| We are | But not |
|--------|---------|
| Energetic | Manic |
| Adaptive | Reactive |
| Forward-thinking | Broad |

## Common Writing Rules

These rules apply to all wv-branded copy — marketing materials, documentation, social media, and in-app text. (Exception: Nordic SQR-RCT follows its own platform voice.)

| Rule | Detail |
|------|--------|
| **Case** | All text is written in lowercase, except for professional identities and corporate names |
| **Spelling** | British English: 'ou' not 'o' (colour, humour), 's' not 'z' (organisation), 'programme' not 'program' (except computer programs) |
| **Seriation** | Oxford comma (e.g., apples, oranges, and bananas) |
| **Date format** | day/month/year: 03 january 2025 (not january 03, 2025 or 01/03/2025) |
| **Time format** | 12-hour with punctuation: 5:30 p.m. (not 5:30pm or 17:30) |
| **Brand name** | Always "winded.vertigo" — never without the period, never capitalised |

## Wordmark & Logo

### Logo Assets in Repo

| File | Format | Usage |
|------|--------|-------|
| `apps/site/images/logo.png` | PNG wordmark | Static site header, og:image |
| `apps/creaseworks/public/images/wv-logo.png` | PNG wordmark (240×127) | Footer brand mark (2x retina) |
| `apps/creaseworks/public/images/wv-icon-square.png` | PNG icon (512×512) | PWA icon, favicon, apple-touch-icon |

### Primary Wordmark

The 3D-style wordmark uses two colours only:
- **Blue (cadet)**: `#273248`
- **White**: `#ffffff`

The logo's slant teases movement to the right — the feeling of leaning into uncertainty. The icon mark is a side view of the wedge where the W of "winded" becomes the V of "vertigo."

### Clearspace & Sizing

- **Clearspace**: defined by the width of the "o" in the wordmark — this is the minimum distance between the wordmark and any other visual or verbal element
- **Minimum width**: 3.81 cm (print) / ~144px (screen) — below this size, use the icon mark instead of the full wordmark
- **Digital footer**: renders at 120px wide desktop, 100px mobile

### Partner Logo Positioning

When displaying the wv wordmark alongside partner logos:
- Can be positioned side by side or stacked, depending on context
- A clear divider separates the logos when placed side by side
- Default ordering is alphabetical unless the partnership context suggests otherwise
- Never overlap the wordmark with partner logos

### Wordmark Don'ts

- Do not use low-resolution versions of the wordmark
- Do not rotate the wordmark
- Do not change the wordmark colours
- Do not add visual effects (drop shadows, glows, gradients) to the wordmark
- Do not stretch or distort the wordmark

### Image Branding / Watermarks

- The primary colour wordmark (without transparency) is used where full visibility is needed
- For watermarks on images, use the white wordmark with subtle placement
- Wordmark transparency on images should not exceed 20%

### Black Wordmark

A black-and-white version of the wordmark exists but should be used sparingly and only when circumstances require it (e.g., single-colour print constraints).

## Colour Palette

All colours are defined in `packages/tokens/index.css` (CSS custom properties) and `packages/tokens/index.ts` (TypeScript constants). **Never hardcode hex values in components.**

### Brand Colours

| Official Name | CSS Variable | Hex | RGB | CMYK | Role |
|---------------|-------------|-----|-----|------|------|
| Cadet Blue | `--wv-cadet` | `#273248` | 39, 50, 72 | 0.46, 0.31, 0, 0.72 | Primary dark — backgrounds, headers, footers |
| Redwood | `--wv-redwood` | `#b15043` | 177, 80, 67 | 0, 0.55, 0.62, 0.31 | Accent, CTA buttons |
| Burnt Sienna | `--wv-sienna` | `#cb7858` | 203, 120, 88 | 0, 0.41, 0.52, 0.2 | Accent hover, warm highlights |
| Champagne | `--wv-champagne` | `#ffebd2` | 255, 235, 210 | 0, 0.08, 0.18, 0 | Light text on dark backgrounds |
| White | `--wv-white` | `#ffffff` | 255, 255, 255 | 0, 0, 0, 0 | Light backgrounds, body text on dark |

**Colour pairing rules**: The palette is flexible and allows for unique combinations, but pairings need to be regulated to maintain a consistent brand impression. Cadet blue should be used most frequently, whether covering large areas or as a punchy accent. Printed colours may appear slightly different depending on the surface — always check for consistency.

### Semantic Colours

The tokens package maps brand colours to functional roles. All text/background combos are tested to WCAG contrast standards.

| Variable | Hex | Contrast | Use |
|----------|-----|----------|-----|
| `--color-text-primary` | `#273248` (cadet) | 11.4:1 on white (AAA) | Body text on light backgrounds |
| `--color-text-secondary` | `#4b5563` | 7.5:1 on white (AAA) | Secondary text |
| `--color-text-muted` | `#6b7280` | 5.0:1 on white (AA) | Muted/tertiary text |
| `--color-text-on-dark` | `#ffebd2` (champagne) | 9.8:1 on cadet (AAA) | Body text on dark backgrounds |
| `--color-accent-on-dark` | `#e09878` | 5.5:1 on cadet (AA) | Interactive accent on dark backgrounds |
| `--color-link` | `#1e40af` | 9.4:1 on white (AAA) | Links on light backgrounds |
| `--color-link-on-dark` | `#93c5fd` | 7.8:1 on cadet (AAA) | Links on dark backgrounds |
| `--color-surface-raised` | `#1e2738` | — | Cards/panels on cadet backgrounds |

### Colour Don'ts

- **Don't** put redwood text on cadet background (2.5:1 — fails all WCAG levels)
- **Don't** use champagne as a background colour (it's text-on-dark only)
- **Don't** invent new brand colours — extend the semantic layer in tokens instead

## Typography

The Inter typeface family anchors all wv typography — over 2,000 glyphs supporting 147 languages.

### Type Scale

| Property | Value | Variable |
|----------|-------|----------|
| Font family | Inter | `--font-body` |
| Fallback stack | ui-sans-serif, system-ui, -apple-system, sans-serif | (in `--font-body`) |
| Body line height | 1.6 | `--line-height-body` |
| Letter spacing | 0.02em | `--letter-spacing-body` |
| Word spacing | 0.04em | `--word-spacing-body` |
| Max line length | 70ch | `--max-line-length` |
| Accessibility font | Atkinson Hyperlegible | `--font-atkinson` (creaseworks) |

### Weight Hierarchy

Three official weights, each with a defined role:

| Weight | Use |
|--------|-----|
| **Inter Bold** | Headings, emphasis, key callouts |
| **Inter Regular** | Documents and formal communication — the default for body text |
| **Inter Light** | Used sparingly to enhance visual hierarchy alongside Bold |

### Typographic Proportion Rule

When combining all three weights in a layout, maintain visual balance:
- Subheaders should be no larger than 50% of the headline's ascender height
- Body copy should be no larger than 50% of the subheaders' cap height

### Document & Digital Rules

- All documents should use black font (`#000000`) by default
- Cadet (`#273248`) can be used sparingly for slide decks, marketing materials, and where design allows
- Static site nav uses Inter ExtraBold (800), 32px, lowercase
- Body text defaults to 16px — never go below 14px for readable content
- The accessibility "dyslexia font" mode swaps to Atkinson Hyperlegible across all form elements (creaseworks)

## Spacing

4px base unit. Use tokens, not arbitrary values.

| Token | CSS Variable | Value |
|-------|-------------|-------|
| xs | `--space-xs` | 4px |
| sm | `--space-sm` | 8px |
| md | `--space-md` | 16px |
| lg | `--space-lg` | 24px |
| xl | `--space-xl` | 32px |
| 2xl | `--space-2xl` | 48px |
| 3xl | `--space-3xl` | 64px |

## Photography Style

- Candid, warm-lit imagery of hands-on creative play
- Muted earth tones that complement the cadet/sienna/champagne palette
- Avoid stock-photo perfection — real moments are better
- Bio photos on `/we/` page: 300px desktop, 260px tablet, grayscale filter with champagne overlay on hover

## App-Specific Brand Notes

### Static Site (windedvertigo.com)
- Full brand expression: cadet backgrounds, champagne text, Inter ExtraBold nav
- Pages: `/`, `/do/`, `/we/`, `/what/`, `/portfolio/`, `/vertigo-vault/`, `/projects/`

### Creaseworks
- Follows wv brand palette via `packages/tokens` import
- Adds "calm theme" mode: desaturated, low-stimulation dark variant for sensory sensitivity
- Footer links back to parent site with logo wordmark
- Header shows only "creaseworks" — no "winded.vertigo" prefix

### Nordic SQR-RCT
- Does NOT use wv brand tokens
- Has its own platform branding by Nordic
- "powered by winded.vertigo" attribution in footer only

### Reservoir, Deep-Deck, Vertigo-Vault
- Import `packages/tokens` for brand consistency
- Reservoir additionally depends on `@windedvertigo/tokens` for shared design system

## Contact

Brand questions or clarification: comms@windedvertigo.com
