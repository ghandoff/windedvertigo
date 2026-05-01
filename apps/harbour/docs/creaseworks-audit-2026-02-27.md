# Creaseworks Site Audit — February 27, 2026

> **STATUS: RESOLVED** — All issues from this audit have been fixed. Emoji fixed, packs nav visible, smoke test passing. See `docs/creaseworks-backlog-2026-02-28.md` for current backlog.

## Issue 1: Garbled Emoji Characters (CRITICAL — Visual)

**What you see:** Strings like `ð¿`, `â¡`, `ð¯`, `ð§©` appearing instead of emoji on playdate cards and detail pages throughout the site.

**Root cause:** Emoji characters in three source files got corrupted during a previous session's file reconstruction. Multi-byte UTF-8 sequences were decoded incorrectly, turning emoji into mojibake.

**Affected files:**

| File | Lines | What's garbled |
|------|-------|----------------|
| `src/components/ui/playdate-card.tsx` | 13–16, 49–51, 178 | Progress tier badges (🌿→ð¿, ⚡→â¡, etc.), energy labels, fire emoji |
| `src/components/ui/entitled-playdate-view.tsx` | 67, 76, 91, 100, 109, 118 | "At a glance" section icons (🎯, ⚡, 🌱, 📋, 🧩 all garbled) |
| `src/app/sampler/[slug]/page.tsx` | 130, 139, 154, 163, 199 | Same "at a glance" section for sampler teaser view |

**Fix:** Replace each garbled byte sequence with the correct emoji character. Approximately 15–20 individual replacements across three files.

---

## Issue 2: Breadcrumb Shows Pack Name Instead of Sampler Context

**What you see:** Click "Cloud Cartographer" from the Sampler page → you end up at `/packs/new-baby-sibling/playdates/cloud-cartographer` with breadcrumb "← back to new baby sibling" instead of returning to the sampler.

**Root cause:** In `src/app/sampler/[slug]/page.tsx` (lines 81–87), when an entitled user clicks a sampler playdate that belongs to a pack, the server-side page does a hard redirect to the pack route:

```
if (isEntitled) {
  redirect(`/packs/${pack.slug}/playdates/${slug}`);
}
```

The pack detail page at `/packs/[slug]/playdates/[playdateSlug]/page.tsx` then renders its standard breadcrumb: `← back to {pack.title}`.

**Fix options:**
- **Option A (recommended):** Pass a `?from=sampler` query param in the redirect, and have the pack playdate page check for it to render "← back to sampler" with href `/sampler` instead.
- **Option B:** Don't redirect entitled users out of sampler — render the full entitled view inline in the sampler route itself.

---

## Issue 3: No Navigation to /packs for Authenticated Users

**What you see:** Once signed in, there's no way to reach the Packs page from the nav bar. The `/packs` URL works if typed directly, but there's no link.

**Root cause:** In `src/components/ui/nav-bar.tsx`:
- Line 121–123: The packs link is explicitly excluded for authenticated users:
  ```
  {!isAuthed && (
    <NavLink href="/packs" ... >packs</NavLink>
  )}
  ```
- Lines 177–184: The mobile bottom tab bar for authenticated users includes sampler, matcher, playbook, reflections, profile — but not packs.

**Fix:** Add the packs NavLink to the authenticated nav links (or keep it visible for all users), and add a packs tab to the authenticated bottom tab bar.

---

## Issue 4: Seasonal Recommendations Banner Not Visible

**What you see:** No seasonal banner appears on the Playbook page despite the feature being implemented.

**Root cause:** The feature is working correctly at the code level:
- `seasonal.ts` correctly detects winter (current season)
- `getSeasonalTags()` returns `["winter", "holiday", "indoor", "cozy", "snow"]`
- `SeasonalBanner` component is rendered in `playbook/page.tsx`
- `/api/seasonal` endpoint returns valid JSON with `"playdates": []`
- The query in `queries/seasonal.ts` uses `campaign_tags && $1::text[]` to match

**The problem is data:** No playdates in the database have `campaign_tags` values matching any of the winter tags. The seasonal banner component returns `null` when no playdates match.

**Fix:** Add campaign_tags to playdates in Notion (e.g., tag "Puddle Scientists" with `["winter", "outdoor"]`, tag indoor activities with `["winter", "indoor", "cozy"]`). The next Notion sync will populate the tags and the banner will appear automatically.

---

## Issue 5: Features Verified Working

These features from the recent implementation were confirmed working on the live site:

| Feature | Status | Notes |
|---------|--------|-------|
| **Feature Y — Nav Icons** | ✅ Working | Inline SVG icons appear next to each nav link; mobile bottom tab bar with color-coded icons |
| **Feature X — Pack Finder** | ✅ Working | Packs page shows situation-based filtering UI |
| **Matcher** | ✅ Working | Material categories, location filters, educational context all functional |
| **Reflections** | ✅ Working | New reflection form loads at `/reflections/new` |
| **Playbook Collections** | ✅ Working | Grid with search bar, collection cards visible |
| **Admin link** | ✅ Working | Appears for admin users in nav bar |
| **Profile with initials avatar** | ✅ Working | Circular avatar with user initials in nav bar |

---

## Priority Order for Fixes

1. **Garbled emoji** — Most visible, affects every page with playdate cards
2. **Packs nav link** — Quick fix, high impact for discoverability
3. **Breadcrumb context** — Confusing UX when arriving from sampler
4. **Campaign tags** — Data entry in Notion, not a code fix
