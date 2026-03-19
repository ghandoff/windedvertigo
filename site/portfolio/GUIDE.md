# Portfolio Page Guide

## Page Structure

```
/portfolio/
├── index.html          ← the portfolio page
├── assets/             ← folder for hosted files (create when needed)
│   ├── prme-workshop-kit.pdf
│   ├── impact-report-2024.pdf
│   └── ...
└── GUIDE.md            ← this file
```

---

## Visual Layout

```
┌─────────────────────────────────────────────────────────────┐
│  [logo]                           what.  we.  do.           │  ← header
├─────────────────────────────────────────────────────────────┤
│                                                             │
│                     selected work.                          │  ← hero title
│        a glimpse into how we design learning...             │  ← subtitle
│                                                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   ┌─────────────────┐   ┌─────────────────┐                │
│   │       📄        │   │       🎬        │                │
│   ├─────────────────┤   ├─────────────────┤                │
│   │ PEOPLE × DESIGN │   │ PEOPLE × DESIGN │                │  ← card grid
│   │ PRME workshop   │   │ play-based...   │                │     (2 columns
│   │ facilitation kit│   │ video walkthrough│                │      on desktop,
│   │ [view pdf →]    │   │ [watch →]       │                │      1 on mobile)
│   └─────────────────┘   └─────────────────┘                │
│                                                             │
│   ┌─────────────────┐   ┌─────────────────┐                │
│   │       📊        │   │       📈        │                │
│   ├─────────────────┤   ├─────────────────┤                │
│   │ PEOPLE × RESEARCH│  │ PEOPLE × RESEARCH│               │
│   │ impact report   │   │ MEL dashboard   │                │
│   │ [view pdf →]    │   │ [explore →]     │                │
│   └─────────────────┘   └─────────────────┘                │
│                                                             │
│   ... more cards ...                                        │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│        want to see how we can help with your project?       │
│                  [ build your package → ]                   │  ← CTA
├─────────────────────────────────────────────────────────────┤
│  © copyright winded.vertigo...              [social icons]  │  ← footer
└─────────────────────────────────────────────────────────────┘
```

---

## Card Anatomy

Each portfolio card has these parts:

```html
<article class="work-card" id="unique-anchor-id">
  <div class="work-card-media">📄</div>           <!-- emoji icon -->
  <div class="work-card-body">
    <span class="work-card-quadrant">people × design</span>
    <h2 class="work-card-title">project title</h2>
    <p class="work-card-type">format • type</p>
    <p class="work-card-desc">Description of the project...</p>
    <a href="URL" class="work-card-cta">view pdf →</a>
  </div>
</article>
```

---

## How to Add Assets

### Option A: Host PDF/file in this repo

1. Create `/portfolio/assets/` folder (if not exists)
2. Add your file: `/portfolio/assets/my-report.pdf`
3. Update the card's CTA link:

```html
<!-- Before -->
<a href="#" class="work-card-cta coming-soon">coming soon</a>

<!-- After -->
<a href="assets/my-report.pdf" class="work-card-cta" target="_blank">view pdf →</a>
```

### Option B: Link to external URL (Figma, YouTube, dashboard, etc.)

```html
<!-- External link -->
<a href="https://www.figma.com/file/xyz" class="work-card-cta" target="_blank" rel="noopener">view in figma →</a>

<!-- YouTube/Vimeo -->
<a href="https://youtu.be/VIDEO_ID" class="work-card-cta" target="_blank" rel="noopener">watch video →</a>

<!-- Live dashboard -->
<a href="https://dashboard.example.com" class="work-card-cta" target="_blank" rel="noopener">explore dashboard →</a>
```

### Option C: Embed video (advanced)

Replace the emoji with an embedded thumbnail or video player:

```html
<div class="work-card-media">
  <iframe src="https://www.youtube.com/embed/VIDEO_ID"
          style="width:100%;height:100%;border:none;"
          allowfullscreen></iframe>
</div>
```

---

## Current Cards & Their Anchor IDs

| Card Title                    | Anchor ID          | Quadrant          | Status      |
|-------------------------------|--------------------|-------------------|-------------|
| PRME active learning workshop | `#prme-workshop`   | people × design   | coming soon |
| play-based learning session   | `#play-based-session` | people × design | coming soon |
| programme impact report       | `#impact-report`   | people × research | coming soon |
| MEL dashboard                 | `#mel-dashboard`   | people × research | coming soon |
| learning game prototype       | `#learning-game`   | product × design  | coming soon |
| design handoff spec           | `#design-handoff`  | product × design  | coming soon |
| UDL audit report              | `#udl-audit`       | product × research| coming soon |
| usability findings video      | `#usability-video` | product × research| coming soon |

**Deep linking:** Use `https://windedvertigo.com/portfolio/#impact-report` to link directly to a specific card.

---

## Adding a New Card

Copy this template and add it inside the `<div class="work-grid">`:

```html
<!-- New Project Name -->
<article class="work-card" id="new-project-id">
  <div class="work-card-media">🎯</div>
  <div class="work-card-body">
    <span class="work-card-quadrant">people × design</span>
    <h2 class="work-card-title">new project name</h2>
    <p class="work-card-type">format • type</p>
    <p class="work-card-desc">Description of what this project is and what makes it notable.</p>
    <a href="assets/new-project.pdf" class="work-card-cta" target="_blank">view pdf →</a>
  </div>
</article>
```

---

## Suggested CTA Labels by Asset Type

| Asset Type       | Emoji | CTA Label           |
|------------------|-------|---------------------|
| PDF document     | 📄    | view pdf →          |
| Video            | 🎬    | watch video →       |
| Dashboard        | 📈    | explore dashboard → |
| Figma file       | 🎨    | view in figma →     |
| Interactive demo | 🎮    | try demo →          |
| Report/findings  | 📊    | read report →       |
| Assessment       | ✅    | view assessment →   |

---

## Package Builder Connection

The Package Builder at `/do/` links to these cards via the "see it in action" section. Each pack shows 2 examples that link here:

- **people × design** → `#prme-workshop`, `#play-based-session`
- **people × research** → `#impact-report`, `#mel-dashboard`
- **product × design** → `#learning-game`, `#design-handoff`
- **product × research** → `#udl-audit`, `#usability-video`

When you update an anchor ID here, also update the corresponding URL in `/do/index.html` in the `CONTENT.packs` object.

---

## Hosted Interactive Demos

Self-contained web-apps live in `/portfolio/assets/<name>/`. Current demos:

| Demo | Directory | Size | Added |
|------|-----------|------|-------|
| MindShift Missions | `assets/mindshift-missions/` | ~120KB (4 files) | 2025 |
| Conference Experience | `assets/conference-experience/` | ~107KB (1 file) | 2026-03 |

### Scaling note (revisit at 5+ demos)

These demos are currently hosted inline in the site repo. This is fine for a
small number of self-contained HTML/CSS/JS files, but if the count grows (5+)
or demos start needing build tools, consider migrating to **Option C: Vercel
rewrite proxy** — each demo becomes its own Vercel project under `apps/`, and
`vercel.json` rewrites route them through `windedvertigo.com/portfolio/assets/*`.
This gives independent deploys without inflating the site bundle. See the
harbour rewrite pattern in `vercel.json` for reference.

---

## Quick Checklist: Publishing an Asset

1. [ ] Add file to `/portfolio/assets/` (if self-hosted)
2. [ ] Update card's `href` attribute
3. [ ] Remove `coming-soon` class from CTA
4. [ ] Update CTA text (e.g., "view pdf →")
5. [ ] Commit and push
6. [ ] Test the live link
