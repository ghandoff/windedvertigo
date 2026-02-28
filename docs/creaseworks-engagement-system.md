# Creaseworks: Engagement, Gamification & Reflections-as-Marketing System

## Research Foundation

This design is informed by gamification research from Self-Determination Theory (SDT), Flow Theory (Csikszentmihalyi), operant conditioning reward loops, and 2025 UGC engagement data showing that gamified user-generated content increases engagement by 50% and that 93% of consumers trust user-created content over brand content.

**Core loop:** Trigger → Action → Reward → Progress → New Trigger

**Key principles applied:**
- **SDT alignment**: Support autonomy (choice), competence (progress visibility), relatedness (community)
- **Variable reward schedules**: Mix predictable milestones with surprise unlocks
- **Loss aversion**: Show what's locked, not just what's available
- **Intrinsic over extrinsic**: Narrative meaning > points; reflection quality > quantity
- **Minimal friction**: The fastest path to a logged reflection should be one tap

---

## Part 1: Reflection Engagement System

### The Engagement Loop

```
Try a playdate → Quick-log it (1 tap) → See progress badge advance
                                       → Get nudge to add a photo
                                       → Earn credit toward free pack
                                       → See your reflection count on playbook
```

### Tier 1: One-Tap Quick Log (Already Built — Enhance)

The `QuickLogButton` already creates a minimal run. Enhance it:

**After quick-log success**, show a 3-second expandable toast:
```
✓ logged! ───────────────────────────
  📸 add a photo for bonus credit?  [tap to expand]
```

This creates a **two-step progressive disclosure** pattern:
1. Zero-friction entry (one tap)
2. Optional photo add (one more tap opens camera)

The photo step is where marketing value gets created, but the barrier to entry is the quick-log, not the photo.

### Tier 2: Photo-First Quick Reflection

New component: `PhotoReflectionButton` — a camera icon button that:
1. Opens device camera directly (using `capture="environment"`)
2. On photo capture, auto-creates a run with the photo attached
3. Shows a minimal inline form (title auto-filled from playdate name, date = today)
4. One-tap submit

**Placement:** Alongside the existing quick-log button on entitled playdate pages and sampler teaser pages.

### Tier 3: Full Reflection (Already Built)

The existing `RunForm` with evidence capture. No changes needed — it's already well-designed with progressive disclosure (optional fields collapsed by default).

---

## Part 2: Reflection Credits & Pack Rewards

### Credit System

**Earning credits:**
| Action | Credits | Rationale |
|--------|---------|-----------|
| Quick-log a playdate | 1 | Lowest friction, lowest value |
| Add a photo to any reflection | 2 | Marketing value (artifact photos) |
| Add a photo with marketing consent | 3 | Highest marketing value |
| Write what-changed + next-iteration | 1 | Qualitative insight |
| Complete a "find again" moment | 2 | Shows deep engagement |
| 7-day reflection streak | 5 | Habit formation bonus |

**Redeeming credits:**
| Reward | Cost | Notes |
|--------|------|-------|
| Unlock 1 sampler playdate PDF | 10 | Low-value, high-accessibility reward |
| Unlock a single premium playdate | 25 | Lets them taste a pack without buying |
| Unlock a full pack | 50 | Major milestone — ~17 photo reflections |

**Implementation:** New `reflection_credits` table:
```sql
CREATE TABLE reflection_credits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  org_id UUID,
  amount INTEGER NOT NULL,
  reason TEXT NOT NULL,           -- 'quick_log', 'photo_added', 'marketing_consent', etc.
  run_id UUID REFERENCES runs_cache(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE credit_redemptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  org_id UUID,
  credits_spent INTEGER NOT NULL,
  reward_type TEXT NOT NULL,      -- 'sampler_pdf', 'single_playdate', 'full_pack'
  reward_ref TEXT,                -- pack_id or playdate_id
  created_at TIMESTAMPTZ DEFAULT now()
);
```

**Why not points?** Credits feel transactional and purposeful. "You've earned 12 credits toward your next free pack" is more motivating than "You have 12 points." The word "credit" implies currency with clear spending power.

### Progress Visibility

On the **playbook page**, show a progress bar:
```
────────── ★ ──────────────────────
12 / 50 credits toward a free pack
[see how to earn more]
```

On **profile**, show lifetime stats:
```
Credits earned: 47  |  Packs unlocked: 1  |  Photos shared: 12
```

---

## Part 3: Photo Privacy & Marketing Consent

### COPPA Compliance (2025 Amended Rule)

Creaseworks serves families with children. The 2025 COPPA amendments require:

1. **Separate parental consent** for non-integral third-party disclosures (marketing use)
2. **Written information security program** proportionate to data sensitivity
3. **No indefinite retention** of children's personal information
4. **Biometric identifiers** (including facial templates) are now personal information

### Three-Tier Photo Classification

When a parent uploads a photo, classify it:

**Tier A: Artifact-Only Photos** (Lowest risk, highest marketing utility)
- Photos of art projects, built structures, arranged materials
- No children visible
- **Consent needed:** Basic terms of service
- **Marketing use:** Social media, website, promotional materials
- **Implementation:** During upload, ask "What's in this photo?" with options:
  - "The thing we made/built" (Tier A)
  - "Us doing the activity" (Tier B)
  - "My child's reaction" (Tier C)

**Tier B: Activity Photos** (Medium risk)
- Children's hands, bodies (not faces) engaged in activity
- **Consent needed:** Marketing opt-in checkbox
- **Marketing use:** With consent only; crop/blur faces if visible
- **Implementation:** Show consent toggle after classification

**Tier C: Face/Emotion Photos** (Highest risk, highest emotional marketing value)
- Children's faces showing joy, concentration, wonder
- **Consent needed:** Full photo release waiver (digital signature)
- **Marketing use:** Only with explicit waiver on file
- **Implementation:** Link to digital waiver form; photo locked from marketing use until waiver completed

### Consent UI Flow

```
[Upload photo] → "What's in this photo?"
                  ○ The thing we made        → ✓ Auto-approved for sharing
                  ○ Us playing together       → □ "OK to share on our social media?"
                  ○ My child's expression     → "To share this, we need a photo release"
                                                [Complete release form →]
```

**Key UX decisions:**
- Never block the reflection submission on consent — photos can be uploaded and consent added later
- Store consent status per-photo, not per-user (a parent might consent for artifact photos but not face photos)
- Show a "shareable" badge on photos with marketing consent so parents know which ones we might use

### Photo Release Waiver (Digital)

Stored in `photo_consents` table:
```sql
CREATE TABLE photo_consents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  evidence_id UUID NOT NULL REFERENCES run_evidence(id),
  user_id UUID NOT NULL REFERENCES users(id),
  consent_tier TEXT NOT NULL,        -- 'artifact', 'activity', 'face'
  marketing_approved BOOLEAN DEFAULT false,
  waiver_signed_at TIMESTAMPTZ,
  waiver_ip TEXT,
  parent_name TEXT,                  -- For face-tier waivers
  child_age_range TEXT,              -- 'under_5', '5_to_8', '9_to_12', '13_plus'
  revoked_at TIMESTAMPTZ,           -- Parents can revoke anytime
  created_at TIMESTAMPTZ DEFAULT now()
);
```

**Revocation:** Parents can revoke marketing consent at any time from their profile. Revocation is immediate — the photo is removed from the marketing pool within 24 hours.

---

## Part 4: FOMO & Promotion Touchpoints

### Touchpoint 1: Pack Preview Badges on Sampler Cards

On `PlaydateCard` in the sampler grid, show a badge for playdates in unpurchased packs.

**Component change:** Add optional `packInfo` prop to `PlaydateCard`:
```typescript
interface PackBadgeInfo {
  packName: string;
  packSlug: string;
}

// In PlaydateCard:
{packInfo && !isEntitled && (
  <Link href={`/packs/${packInfo.packSlug}`}
    className="inline-flex items-center gap-1 text-[10px] text-sienna/70 hover:text-sienna">
    🔒 {packInfo.packName}
  </Link>
)}
```

**Data flow:** The sampler grid page calls `getFirstVisiblePackForPlaydate()` for each playdate and passes it through.

### Touchpoint 2: "Unlock More" on Playbook Page

After the collections grid, show packs the user hasn't purchased:

```
───────────────────────────────────────
  keep exploring
  Based on your play history, you might love:

  [New Baby Sibling]    [Sensory Explorer]
  8 playdates            6 playdates
  welcoming change       sensory discovery
  [see what's inside →]  [see what's inside →]
───────────────────────────────────────
```

**Implementation:** New server component `PackUpsellSection` that:
1. Fetches `getVisiblePacks()` minus `listOrgEntitlements(orgId)`
2. Ranks by relevance to user's play history (shared arc_emphasis tags)
3. Shows top 2 unowned packs

### Touchpoint 3: Matcher Premium Highlights

**Already implemented.** The `MatcherResultCard` already shows pack links and "get the pack →" buttons for unentitled playdates. No code changes needed.

### Touchpoint 4: Seasonal Campaign Tags (Data Task)

The seasonal banner code works. Tag playdates in Notion:

**Winter (Dec–Feb):** indoor, cozy, calm, sensory-focused activities
**Spring (Mar–May):** outdoor, growth, planting, nature exploration
**Summer (Jun–Aug):** water, adventure, high-energy, travel-friendly
**Fall (Sep–Nov):** harvest, routine-building, back-to-school transitions

### Touchpoint 5: Post-Reflection Upsell CTA

After a successful reflection submission, show a contextual upsell:

```
✓ Reflection saved!

  Love exploring with [Playdate Name]?
  [Pack Name] has 7 more playdates like this one.
  [unlock the full pack →]

  ──── or ────

  You're 8 credits away from a free pack!
  📸 Add a photo to earn 2 more credits.
```

**Implementation:** Modify the run-form success state to show pack upsell if the playdate belongs to an unowned pack, or credit progress if they're working toward a reward.

### Touchpoint 6: Pack Finder Improvements

On `/packs`, add:
- Playdate count per pack with preview titles
- "X families exploring" social proof (from runs_cache aggregate)
- Seasonal relevance callouts
- Visual progress: "You've tried 3 of 12 in Starter"

---

## Part 5: Implementation Priority

| # | Change | Effort | Impact | Dependencies |
|---|--------|--------|--------|-------------|
| 1 | Quick-log photo toast enhancement | ~1hr | High engagement | None |
| 2 | Pack preview badges on sampler cards | ~1hr | FOMO discovery | Pack query |
| 3 | Post-reflection upsell CTA | ~1hr | Conversion moment | Pack query |
| 4 | Credit system DB schema | ~30min | Foundation | Migration |
| 5 | Playbook upsell section | ~2hr | Engaged user conversion | Pack query |
| 6 | Photo consent classification UI | ~2hr | Marketing pipeline | Evidence system |
| 7 | Credit progress bar on playbook | ~1hr | Motivation visibility | Credit schema |
| 8 | Photo-first quick reflection button | ~2hr | Marketing content | Camera API |
| 9 | Pack finder improvements | ~3hr | Conversion optimization | Aggregate queries |
| 10 | Tag playdates with campaign_tags | Data entry | Seasonal banner | Notion access |

---

## Design Philosophy

This system follows "white hat" gamification — empowering parents with visible progress and meaningful rewards rather than manipulating through artificial scarcity or dark patterns. The credits system rewards genuine engagement (trying playdates, reflecting on them, sharing artifacts) rather than arbitrary metrics.

The photo consent system prioritizes child safety over marketing convenience. A parent should never feel pressured to share photos of their children. Artifact photos (the things kids make) are the primary marketing asset — they're lower-risk, highly shareable, and tell a compelling story without requiring children's faces.

The FOMO touchpoints show parents what exists without hiding the free sampler content. The goal is discovery, not gatekeeping. A parent who sees "🔒 New Baby Sibling" on a sampler card learns that premium content exists in a natural, non-aggressive way.
