# Site Content CMS — Editing Guide

> **Audience:** Anyone editing winded.vertigo website content in Notion.
> **Last updated:** 2026-03-03

The winded.vertigo website and reservoir apps are powered by a Notion database called **Site Content CMS**. Editing a row in Notion changes what appears on the live site after a sync. This guide explains every field, how they interact, and what to expect when you make changes.

---

## How It Works (The Big Picture)

```
 ┌──────────────┐      sync script      ┌──────────────┐      browser fetch     ┌──────────────┐
 │  Notion CMS  │  ──────────────────▶  │  JSON files   │  ──────────────────▶  │  HTML pages   │
 │  (database)  │   fetch-notion.js     │  (per page)   │   client-side JS      │  (rendered)   │
 └──────────────┘                       └──────────────┘                        └──────────────┘
```

1. **You edit content in Notion** — the Site Content CMS database
2. **A sync script runs** — `scripts/fetch-notion.js` reads Notion and writes JSON files
3. **The website loads JSON at runtime** — each page fetches its data file and renders content

The JSON files live at `apps/site/data/site-content-{page}.json`. One file per page value (e.g., `what`, `we`, `do`, `home`, `reservoir`).

---

## The Database Fields

Every row in the CMS has these fields. Here's what each one does:

### Required Fields

| Field | Type | What It Does |
|-------|------|-------------|
| **Name** | Title | The identifier for this content piece. Often displayed as a heading (h2/h3) on the page. Keep it short, lowercase, descriptive. |
| **Page** | Select | Which page this content belongs to: `home`, `what`, `we`, `do`, or `reservoir`. This is how the sync groups content into separate JSON files. |

### Content Fields

| Field | Type | What It Does |
|-------|------|-------------|
| **Content** | Rich Text | The main body text. Supports Notion formatting — **bold** and *italic* are preserved through the sync. This is what renders as paragraph text on the site. |
| **Tagline** | Text | A short descriptor. Used differently per page — it can be a subtitle, a role title (on `/we`), or a page `<title>` tag (on `/what` metadata). |
| **Features** | Text | A comma-separated list. On `/we`, this becomes the skill tags below a team member. On `/do`, it becomes bullet points in a package card. |

### Organization Fields

| Field | Type | What It Does |
|-------|------|-------------|
| **Order** | Number | Controls the sort position within a section. Lower numbers appear first. Items with the same order value may need explicit ordering in the page's JavaScript. |
| **Content Type** | Select | The category of content. Determines how the page treats this row. See the "Content Types" section below. |
| **Section** | Text | A grouping key that organizes content into visual areas. For example, on `/what`: `hero`, `body`, `pillars`, `process`. Each page's JavaScript groups items by this value. |
| **Layout** | Select | Controls the visual presentation variant. Different layouts get different CSS styling. See the "Layout Options" section below. |

### Visual Fields

| Field | Type | What It Does |
|-------|------|-------------|
| **Icon** | Text | An emoji or image URL. When present, it displays alongside the content. Examples: `🎨`, `📷`, `🔬` |
| **Brand Color** | Select | A named brand color (`sienna`, `redwood`, `cadet`). Currently used on reservoir game cards to set the primary color. |
| **Accent Color** | Select | A secondary named color. Used alongside Brand Color for two-tone styling on game cards. |
| **Image URL** | URL | A link to an image. Used for photo strips, hero backgrounds, or content imagery. Paste a full URL — not a Notion file upload. |
| **Link** | URL | A destination URL. Used for navigation links, CTA buttons, social media links, or anything clickable. |

### Publishing

| Field | Type | What It Does |
|-------|------|-------------|
| **Status** | Select | Controls whether this row syncs to the site. **Leave empty or set to `live`** for content that should appear. Set to `draft` or `archived` to hide content without deleting the row. |

---

## Content Types

The **Content Type** field tells the page what kind of content this row represents:

| Type | Used On | What It Renders As |
|------|---------|-------------------|
| `hero` | what, do, reservoir | Large centered heading text — the page's main statement |
| `body` | what, do | Standard paragraph content. Combined with `layout` for different visual treatments |
| `metadata` | all pages | Not visible on page — provides the page `<title>` (via Tagline) and `<meta description>` (via Content) for SEO |
| `nav` | home | Navigation links. Name = internal label, Tagline = display text, Link = destination URL |
| `footer` | home | Footer content. Used for social links and copyright text |
| `team-member` | we | A person card with Name as their name, Tagline as their role, Content as bio, Features as skill tags |
| `game-card` | reservoir | An interactive game card with Name, Content (description), Brand/Accent Colors, Icon, and Link |
| `credential` | reservoir | A credential or qualification badge with Name and Icon |
| `principle` | reservoir | A design principle with Name (title) and Content (explanation) |
| `cta` | do | A call-to-action block with Name, Content, Link, and Features (as bullet points) |
| `package-pack` | do | A service package with Name, Content (description), and Features (as included items) |

---

## Layout Options

The **Layout** field changes how a `body` content type is visually presented. Currently active on the `/what` page:

| Layout | Visual Effect | When To Use |
|--------|--------------|-------------|
| `default` | Standard paragraph, left-aligned | General body text, introductions |
| `card` | Bordered container in a grid | Short pieces that should be visually grouped (pillars, features) |
| `centered` | Centered text with constrained width | Sub-headings, transition statements |
| `side-by-side` | Two-column: icon + text | Process steps, items with icons |
| `highlight` | Left border accent, indented | Pull quotes, important callouts |
| `full-width` | Full-width with top/bottom borders | Section dividers, key statements |

When multiple consecutive items have `layout: card`, they are automatically grouped into a responsive grid.

---

## Page-by-Page Guide

### `/what` — What We Do

**Sections used:** `hero`, `metadata`, `body`, `pillars`, `process`

| What To Edit | Which Row(s) | Fields That Matter |
|-------------|-------------|-------------------|
| Page heading ("learning is change.") | Row where section = `hero` | **Name** = the heading text |
| Intro paragraph | Row where section = `body`, order = 2 | **Content** = the paragraph text |
| The three pillars (play, justice, aliveness) | Rows where section = `pillars` | **Name** = pillar title, **Content** = description |
| Process steps (find, fold, unfold, find again) | Rows where section = `process` | **Name** = step title, **Content** = description |
| Photo strip images | Any row with `imageUrl` filled in | **Image URL** = full URL to an image |
| Page title + SEO description | Row where section = `metadata` | **Tagline** = page title, **Content** = meta description |

**Ordering note:** The three pillars display in a fixed order (play → justice → aliveness) and the four process steps in a fixed order (find → fold → unfold → find again). Changing their Name values will break the ordering — if you rename them, the page JavaScript needs updating too.

### `/we` — Who We Are

**Sections used:** `metadata`, `team`

| What To Edit | Which Row(s) | Fields That Matter |
|-------------|-------------|-------------------|
| A team member's name | Row where type = `team-member` | **Name** = full name |
| Their role/title | Same row | **Tagline** = role (e.g., "founder + director") |
| Their bio | Same row | **Content** = biography text |
| Their skills | Same row | **Features** = comma-separated list (e.g., "play design, research, facilitation") |
| Their profile link | Same row | **Link** = URL to LinkedIn, portfolio, etc. |

### `/do` — What We Offer

**Sections used:** `hero`, `metadata`, `cta`, `package-builder`

| What To Edit | Which Row(s) | Fields That Matter |
|-------------|-------------|-------------------|
| Page heading | Row where section = `hero` | **Name** = heading text |
| Service packages | Rows where type = `package-pack` | **Name** = package name, **Content** = description, **Features** = included items |
| Call-to-action | Row where type = `cta` | **Name** = CTA label, **Content** = description, **Link** = button destination |

### `/home` — Homepage

**Sections used:** `metadata`, `nav`, `footer`, `social`

| What To Edit | Which Row(s) | Fields That Matter |
|-------------|-------------|-------------------|
| Navigation links | Rows where type = `nav` | **Tagline** = display text, **Link** = destination |
| Social media links | Rows where section = `social` | **Name** = platform name, **Icon** = emoji, **Link** = profile URL |
| SEO metadata | Row where section = `metadata` | **Tagline** = page title, **Content** = meta description |

### `/reservoir` — Game Platform Landing

**Sections used:** `hero`, `metadata`, `nav`, `games`, `why`, `principles`, `bio`, `closing-cta`

| What To Edit | Which Row(s) | Fields That Matter |
|-------------|-------------|-------------------|
| Game cards | Rows where type = `game-card` | **Name**, **Content** (description), **Brand Color**, **Accent Color**, **Icon**, **Link** |
| Design principles | Rows where type = `principle` | **Name** = principle title, **Content** = explanation |
| Credentials | Rows where type = `credential` | **Name** = credential, **Icon** = emoji |

**Color options for game cards:**
- `sienna` — warm orange-brown (#cb7858)
- `redwood` — earthy red (#b15043)
- `cadet` — dark navy (#273248)

---

## Formatting Tips

### Text Formatting in Content Field
- **Bold text** → wraps in `<strong>` tags on the site
- *Italic text* → wraps in `<em>` tags on the site
- Plain paragraphs are separated by line breaks in Notion

### Features Field Format
Write comma-separated items:
```
play design, research, facilitation, learning science
```
These render as individual tags or bullet points depending on the page.

### Image URLs
- Must be full URLs (e.g., `https://example.com/photo.jpg`)
- Notion file uploads do NOT work — use externally hosted images
- Images should be optimized for web (compressed, appropriate dimensions)

### Icons
- Use a single emoji: `🎨`, `📷`, `🔬`, `🧠`
- Or paste an image URL for a custom icon

---

## Running a Sync

After editing in Notion, run the sync to update the site:

```bash
# From the monorepo root
NOTION_API_KEY=ntn_... node scripts/fetch-notion.js
```

This regenerates all `apps/site/data/site-content-*.json` files. The changes will be visible on the next page load (no build step needed — it's fetched at runtime).

**For the live site:** commit the updated JSON files and push to trigger a GitHub Pages deployment.

---

## Common Tasks

### Add a new team member
1. Create a new row in Site Content CMS
2. Set **Page** = `we`, **Content Type** = `team-member`, **Section** = `team`
3. Fill in **Name**, **Tagline** (role), **Content** (bio), **Features** (skills)
4. Set **Order** to position them relative to other team members
5. Run the sync script

### Change the hero text on a page
1. Find the row with **Content Type** = `hero` and the correct **Page** value
2. Edit the **Name** field (this is what displays as the heading)
3. Run the sync script

### Hide content without deleting it
1. Set the **Status** field to `draft` or `archived`
2. Run the sync script — the row will be excluded from the JSON

### Add a new game to the reservoir
1. Create a new row with **Page** = `reservoir`, **Content Type** = `game-card`, **Section** = `games`
2. Fill in **Name**, **Content**, **Icon**, **Link**, **Brand Color**, **Accent Color**
3. Set **Order** to position it relative to other games
4. Run the sync script

---

## Troubleshooting

| Problem | Likely Cause | Fix |
|---------|-------------|-----|
| Content not appearing after sync | **Status** field set to draft/archived | Clear the Status field or set to `live` |
| Content appears on wrong page | **Page** field has wrong value | Change the Page select to the correct page |
| Content appears in wrong position | **Order** value incorrect | Adjust the Order number |
| Formatting not preserved | Used unsupported Notion formatting | Stick to bold and italic — other formats (code, color, etc.) are stripped |
| Image not showing | Used a Notion file upload instead of URL | Paste an external image URL in the Image URL field |
| Page title wrong | **Tagline** on the metadata row is wrong | Edit the Tagline on the row where Section = `metadata` |

---

## Architecture Reference

For developers working on the rendering code:

- **Notion config:** `scripts/notion-config.js` — database IDs and property mappings
- **Sync script:** `scripts/fetch-notion.js` — the `fetchSiteContent()` function
- **Data files:** `apps/site/data/site-content-{page}.json`
- **Consumer pages:** Each HTML page in `apps/site/{page}/index.html` has inline JS that fetches and renders its JSON
- **Design tokens:** `packages/tokens/index.css` (canonical) and `apps/site/styles/tokens.css` (local copy for GitHub Pages)
- **Shared footer HTML:** `packages/tokens/footer.html` synced via `scripts/sync-footer.mjs`
