# Creaseworks: Paywall, Promotion & FOMO Strategy

## Security Assessment: Your IP Is Protected

Your entitlement system is **rock solid**. I audited every access pathway and found zero vulnerabilities. Here's why URL hacking won't work:

The pack playdate page (`/packs/[slug]/playdates/[playdateSlug]`) runs three independent checks before showing any content. First, `requireAuth()` blocks unauthenticated visitors entirely. Second, `checkEntitlement(orgId, packId)` verifies the user's organization actually purchased that specific pack — buying "Starter" gives zero access to "Premium." Third, `isPlaydateInPack(playdateId, packId)` confirms the playdate actually belongs to that pack, preventing parameter swapping. If any check fails, the user gets a generic 404 — they can't even confirm the route exists.

The PDF download API has the same triple-check plus returns 403 on failure. The sampler teaser page uses query-level column selectors that physically exclude the find/fold/unfold content from the database response. Even if someone intercepted the network request, the premium fields simply aren't in the payload.

The field-level access control is particularly strong: four tiers (teaser → entitled → collective → internal) with a runtime `assertNoLeakedFields()` guard in dev/staging that catches any accidental column leaks.

**Bottom line: a Starter subscriber cannot see Premium content by manipulating URLs, forging requests, or any other client-side trick.**

---

## The Real Problem: Packs Are Invisible

Security is handled. The actual gap is **discovery and desire**. Right now:

- Authenticated users had no nav link to `/packs` (fixed today)
- Pack promotions only appear in the sampler teaser's locked content section
- No cross-selling happens on the playbook, matcher, or reflections pages
- The seasonal banner (which could drive urgency) has no campaign-tagged playdates yet
- Profile shows owned packs but doesn't surface what's available to buy

The site currently lets entitled users enjoy their purchased content in a frictionless way — which is great — but it never reminds them that more exists.

---

## Proposed Promotion & FOMO Touchpoints

### 1. Sampler Cards — "Pack Preview" Badge (Low Effort)

On PlaydateCard in the sampler grid, add a subtle badge for playdates that belong to a pack the user hasn't purchased. Something like a small lock icon or "in [Pack Name]" tag below the title. When tapped, the teaser page already has the "full facilitation guide" CTA — but the card itself currently gives no hint that this playdate is premium.

**Implementation:** In `playdate-card.tsx`, accept an optional `packName` prop. When present and the user isn't entitled, show a `🔒 {packName}` chip in the metadata row. The sampler grid page would pass this from the pack lookup it already does.

### 2. Playbook — "Unlock More" Contextual Upsells (Medium Effort)

The playbook is where engaged parents spend time. After the collections grid, add a section showing packs the user hasn't purchased yet, framed around the child's activity: "Based on what you've been exploring, you might love **New Baby Sibling** — 8 playdates about welcoming change."

**Implementation:** Query for packs the user's org does NOT own. Show 1-2 as cards with playdate count, situation description, and a CTA. This could live below the collections section or as a dismissible banner.

### 3. Matcher Results — "Premium Match" Highlights (Medium Effort)

When the matcher returns results, some may be in packs the user hasn't bought. Instead of hiding them, show them with a lock overlay and "Available in [Pack Name]" — this creates FOMO by showing the parent exactly what they're missing for their specific situation.

**Implementation:** The matcher already returns playdate data including pack associations. Add a visual treatment (lock icon, muted styling, pack CTA) for unentitled results. Keep them in the results list rather than filtering them out.

### 4. Seasonal Banner — Campaign Tags (Data Task)

The seasonal banner code is complete and working. It just needs data. Tag 4-6 playdates per season in Notion with campaign_tags like "winter", "indoor", "cozy". The banner automatically appears on the playbook page with seasonal recommendations. If some seasonal playdates are in unpurchased packs, this becomes a natural upsell moment.

**Action items:**
- Tag winter playdates: indoor activities, cozy/calm playdates, holiday-themed activities
- Tag spring playdates: outdoor, nature, growth-themed activities
- Plan for summer and fall tags

### 5. Reflections — "Want to Try More?" Post-Log CTA (Low Effort)

After a parent logs a reflection, they're in a positive mindset — their child just had a great experience. This is the perfect moment for a soft upsell: "Love exploring? [Pack Name] has 6 more playdates like this one." Show this only if the playdate belongs to a pack category where unowned packs exist.

### 6. Pack Finder Page — Comparison & Urgency (Medium Effort)

The packs page (now linked in nav) could benefit from:
- A "what's included" expandable preview showing playdate titles (teasers only) for each pack
- Visual indicators of how many playdates are in each pack
- Social proof: "12 families exploring this pack" (if you track this)
- Seasonal callouts: "Perfect for winter — indoor activities the whole family will love"

---

## FOMO-Specific Tactics

**Show what's locked, not just what's available.** The most effective FOMO comes from letting parents see the *shape* of what they're missing. The sampler teaser page already does this well (showing the at-a-glance section, materials, and a "full facilitation guide" locked section). Extend this pattern:

- **Playdate count per pack** on pack cards: "12 playdates including 4 you haven't tried"
- **Blurred preview** of the find/fold/unfold steps on the sampler teaser (CSS blur over placeholder text)
- **"Parents are saying..."** section with anonymized reflection snippets from entitled users on that playdate (requires aggregation query)
- **Progress visibility**: "You've completed 3 of 12 playdates in Starter. Unlock New Baby Sibling to keep exploring."

**Create urgency without being pushy.** The seasonal banner is your best tool here — it rotates naturally and creates time-limited relevance ("These winter playdates are perfect right now"). You could also consider limited-time pricing or bundle offers, though that's a business decision beyond the code.

---

## What NOT to Build

- **Hard paywalls on the sampler grid:** Don't hide pack playdates from the sampler. Showing them creates discovery. Hiding them reduces perceived catalog size.
- **Aggressive pop-ups or modals:** They feel wrong for a family/education product. The soft contextual approach (badges, post-action CTAs, blurred previews) fits the brand better.
- **Server-side paywall middleware:** Your page-level entitlement checks are already tight. Adding middleware would add latency without security benefit.

---

## Priority Implementation Order

| Priority | Change | Effort | Impact |
|----------|--------|--------|--------|
| 1 | Tag playdates with campaign_tags in Notion | Data entry | Unlocks seasonal banner |
| 2 | Pack preview badge on sampler cards | ~1 hour | Shows premium content exists |
| 3 | "Unlock more" section on playbook page | ~2 hours | Upsells to engaged users |
| 4 | Premium match highlights in matcher | ~2 hours | Contextual FOMO at discovery |
| 5 | Post-reflection upsell CTA | ~1 hour | Captures positive moment |
| 6 | Pack finder comparison improvements | ~3 hours | Improves conversion on packs page |
