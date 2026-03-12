# Video Walkthrough Production Plan — vertigo.vault

> **Status**: Draft — 2026-03-12
> **Context**: Practitioner pack ($19.99) promises video walkthroughs but no video infrastructure exists yet.

---

## 1. Infrastructure

### Hosting: Cloudflare Stream (recommended)

| Consideration | Cloudflare Stream | YouTube Unlisted | Mux |
|---------------|------------------|------------------|-----|
| Access control | Signed URLs, token auth | Unlisted link (no real gating) | Signed playback IDs |
| Cost | $1/1000 min stored, $5/1000 min delivered | Free | $0.007/min stored + $0.025/min streamed |
| Embed | iframe or Stream Player SDK | iframe | mux-player web component |
| HLS adaptive | Yes | Yes | Yes |
| CF account | Already have one (MCP tools) | N/A | New vendor |
| DRM | Basic token | None | Optional |

**Recommendation**: Start with **Cloudflare Stream** — we already have a CF account, the pricing is simple, and signed URLs let us gate access at the practitioner tier without exposing public links.

### Data model

Add a `video_id` column (Cloudflare Stream video UID) to `vault_activities_cache`:

```sql
ALTER TABLE vault_activities_cache ADD COLUMN video_id TEXT;
```

The existing `video_url` column can be computed from `video_id` at query time (signed URL generated per request), or we can keep `video_url` as a signed embed URL generated during sync.

**Preferred approach**: Generate signed embed URLs at request time in the detail page server component. This keeps the DB schema simple and avoids storing expiring URLs.

### Column access (already done)

`video_url` is already in `VAULT_PRACTITIONER_COLUMNS` and `VAULT_INTERNAL_COLUMNS` in `lib/security/column-selectors.ts`. The detail page already renders a video iframe when `video_url` is truthy. No code changes needed for gating.

---

## 2. Content types

### A. Live facilitation recordings

- **What**: Record a facilitator running the activity with a real group
- **Duration**: 3–8 minutes (condensed, not full session)
- **Value**: Shows pacing, energy, transitions, group dynamics
- **Equipment**: Camera + lapel mic (facilitator), wide shot (group)
- **Post-production**: Trim dead time, add chapter markers, overlay activity name

### B. Simulation / animated walkthroughs

- **What**: Screen-recorded walkthrough using slides, diagrams, or a "virtual room" simulation
- **Duration**: 2–5 minutes
- **Value**: Can be produced without a live group; good for complex activities
- **Equipment**: Screen recorder (OBS / Loom), presentation deck, voiceover mic
- **Post-production**: Add captions, chapter markers, branded intro/outro

### C. Hybrid (recommended starting approach)

- **What**: Facilitator talks to camera with slides/diagrams as B-roll
- **Duration**: 3–6 minutes
- **Value**: Personal connection + visual clarity. Lowest barrier to produce at scale.
- **Equipment**: Webcam or phone (1080p min), lapel mic, slide deck
- **Post-production**: Picture-in-picture overlay, captions, branded template

---

## 3. Production pipeline

```
Author in Notion  →  Record  →  Edit  →  Upload to CF Stream  →  Add video_id to Notion  →  Sync to DB
```

### Step-by-step

1. **Script**: Add a "Video Script" property (rich_text) to the Notion vault database. Facilitator writes a brief outline of what to cover.
2. **Record**: Hybrid format — facilitator walks through the activity on camera with slides.
3. **Edit**: Trim, add branded intro/outro template, add captions (auto-generate via Whisper or CF Stream's built-in captioning).
4. **Upload**: Upload to Cloudflare Stream via API or dashboard. Note the video UID.
5. **Link**: Add the CF Stream video UID to the activity's Notion page (new "Video ID" property).
6. **Sync**: Existing Notion sync pipeline picks up the `video_id` and writes it to `vault_activities_cache`.
7. **Serve**: Detail page generates a signed embed URL at request time for practitioner+ users.

### Batch production target

| Phase | Activities | Timeline | Focus |
|-------|-----------|----------|-------|
| Pilot | 5 PRME activities | 2 weeks | Validate format, gather feedback |
| Wave 1 | 15 explorer activities | 4 weeks | Most-viewed activities first |
| Wave 2 | 30 remaining activities | 6 weeks | Complete coverage |
| Ongoing | New activities | As added | Include video in authoring workflow |

---

## 4. Player component

The detail page already has a video section (`app/[slug]/page.tsx`, lines 328–350) that renders an iframe. For Cloudflare Stream, replace the iframe with the Stream Player embed:

```html
<iframe
  src="https://customer-{code}.cloudflarestream.com/{video_id}/iframe"
  allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
  allowFullScreen
  style="border:none; width:100%; height:100%"
/>
```

Or use the Stream Player SDK for more control (play/pause events, analytics, chapters):

```html
<stream src="{video_id}" controls></stream>
<script data-cfasync="false" defer type="text/javascript"
  src="https://embed.cloudflarestream.com/embed/sdk.latest.js"></script>
```

### Signed URLs for access control

Generate a signed token server-side using CF Stream's signing key:

```typescript
import { signStreamUrl } from "@/lib/cloudflare/stream";

const signedUrl = await signStreamUrl(activity.video_id, {
  expiresIn: 3600, // 1 hour
  accessRules: [{ type: "any" }],
});
```

This prevents practitioner URLs from being shared — each URL expires after 1 hour.

---

## 5. Token economics

| Item | Cost estimate |
|------|-------------|
| CF Stream storage (50 videos × 5 min avg) | 250 min × $0.001 = ~$0.25/mo |
| CF Stream delivery (1000 views/mo × 5 min) | 5000 min × $0.005 = ~$25/mo |
| Production (DIY hybrid format) | Time cost — no cash outlay if self-produced |
| Production (contracted editor) | ~$50–100/video for trim + captions + branding |
| Whisper captioning (self-hosted) | Free (open source) or ~$0.006/min via OpenAI API |

**Break-even**: At $19.99/practitioner pack, ~2 sales/month covers delivery costs. Production is the main investment — budget ~$2,500–5,000 for contracted editing of 50 videos at scale, or $0 if produced in-house.

---

## 6. Implementation sequence

1. **Infra** (1 day): Set up Cloudflare Stream, generate signing keys, add env vars
2. **Data model** (30 min): Add `video_id` column, update Notion sync to extract it
3. **Player** (1 hour): Update detail page to generate signed embed URLs
4. **Pilot** (2 weeks): Record 5 pilot videos, upload, test end-to-end
5. **Iterate**: Gather feedback, refine format, begin wave 1
