# w.v port — AI Integration Guide

## Overview

The w.v port at `port.windedvertigo.com` is a Next.js 16 app backed by Notion databases, with AI features powered by the Claude API (Anthropic). AI is embedded throughout the port — not isolated to a single page.

**Stack:** Next.js 16 + React 19 + Notion API + Anthropic Claude + Resend + shadcn/ui + Tailwind CSS + Vercel

---

## Architecture

```
port/
├── lib/ai/                    # AI core
│   ├── types.ts               # Types, cost model, feature definitions
│   ├── client.ts              # Claude API wrapper + token tracking + JSON parser
│   ├── usage-store.ts         # Usage logging, budget, cost breakdown
│   ├── email-draft.ts         # AI email generation
│   ├── nl-search.ts           # Natural language → port filters
│   ├── relationship-score.ts  # Contact health scoring
│   └── next-best-action.ts    # Follow-up recommendations
├── app/api/ai/                # API routes (8 endpoints)
│   ├── email-draft/route.ts
│   ├── nl-search/route.ts
│   ├── relationship-score/route.ts
│   ├── next-best-action/route.ts
│   ├── subject-score/route.ts
│   ├── usage/route.ts
│   ├── budget/route.ts
│   └── costs/route.ts
├── app/components/            # AI-powered UI components
│   ├── ai-hub-dashboard.tsx   # Economics dashboard (AI Hub page)
│   ├── ai-health-badge.tsx    # Contact health score
│   ├── ai-outreach-card.tsx   # Org outreach suggestions
│   ├── ai-pipeline-nudges.tsx # Pipeline smart nudges
│   ├── ai-subject-score.tsx   # Subject line scorer
│   ├── ai-activity-insight.tsx# Activity pattern detection (zero-cost)
│   ├── ai-win-probability.tsx # RFP win probability (zero-cost)
│   └── ai-search-bar.tsx      # Global NL search
└── app/(dashboard)/ai-hub/    # AI Hub page (economics center)
```

---

## AI Features — Where They Live

### Embedded in Existing Pages

| Feature | Page | Component | Trigger | API Cost |
|---------|------|-----------|---------|----------|
| **Health score badge** | Contact detail `/contacts/[id]` | `ai-health-badge.tsx` | On-demand button | ~$0.002 |
| **Activity insights** | Contact detail `/contacts/[id]` | `ai-activity-insight.tsx` | Auto (server render) | **Free** |
| **Outreach suggestions** | Org detail `/organizations/[id]` | `ai-outreach-card.tsx` | On-demand button | ~$0.04 |
| **Pipeline nudges** | Pipeline `/` | `ai-pipeline-nudges.tsx` | On-demand button | ~$0.04 |
| **Subject line score** | Campaign step editor | `ai-subject-score.tsx` | Auto (debounced 800ms) | ~$0.001 |
| **AI template generate** | Template form (campaigns) | `template-form.tsx` | On-demand button | ~$0.014 |
| **Win probability** | RFP radar | `ai-win-probability.tsx` | Auto (formula) | **Free** |
| **Global AI search** | All dashboard pages (top nav) | `ai-search-bar.tsx` | On-demand (Enter key) | ~$0.002 |
| **AI email draft** | Email composer `/email` | `email-composer.tsx` | On-demand button | ~$0.014 |
| **Tone/purpose selectors** | Email composer `/email` | `email-composer.tsx` | UI selection | — |

### Standalone Page

| Feature | Page | Purpose |
|---------|------|---------|
| **AI Hub** | `/ai-hub` | Token economics, usage analytics, budget controls, full cost breakdown |

---

## Cost Model

### Per-Feature Cost Estimates

| Feature | Model | Avg Input | Avg Output | Cost/Call |
|---------|-------|-----------|------------|-----------|
| Email Draft | Sonnet | ~2,000 tok | ~500 tok | ~$0.014 |
| NL Search | Haiku | ~1,500 tok | ~200 tok | ~$0.002 |
| Health Score | Haiku | ~1,000 tok | ~300 tok | ~$0.002 |
| Next Actions | Sonnet | ~5,000 tok | ~1,500 tok | ~$0.038 |
| Subject Score | Haiku | ~200 tok | ~50 tok | ~$0.001 |

### Model Selection Strategy

- **Sonnet** (`claude-sonnet-4-6`) — creative generation: email drafts, action recommendations
- **Haiku** (`claude-haiku-4-5-20251001`) — fast extraction: search parsing, scoring, classification

### Budget Controls

- Default: **$50/month** (configurable in AI Hub)
- Warning at **80%** spend
- Auto-pause all AI features when budget exceeded (429 responses)
- Budget resets monthly

### Total Cost of Ownership

Tracked in AI Hub economics tab:
- **Claude API** — direct per-call token costs
- **Notion API** — estimated calls per month (free tier monitoring)
- **Vercel compute** — serverless function GB-seconds
- **Infrastructure** — bandwidth + R2 storage
- **Operational** — dev hours for prompt tuning, model upgrades, monitoring

---

## Zero-Cost Features

These use NO AI API calls — computed from existing port data:

1. **Activity pattern detection** (`ai-activity-insight.tsx`)
   - Days since last contact → staleness alerts
   - Outcome positive/negative ratios
   - Response timing patterns
   - Activity frequency averages

2. **Win probability** (`ai-win-probability.tsx`)
   - Formula: `base(30) + fitScore(0-25) + serviceMatch(0-15) + statusProgression(0-15) - valuePenalty(0-5)`
   - Color-coded: green (≥60%), yellow (35-59%), red (<35%)

---

## Environment Variables

| Variable | Required | Where | Purpose |
|----------|----------|-------|---------|
| `ANTHROPIC_API_KEY` | Yes | Vercel env vars | Claude API authentication |
| `NOTION_TOKEN` | Yes | Vercel env vars | Notion database access (pre-existing) |
| `GOOGLE_CLIENT_ID` | Yes | Vercel env vars | Google SSO (pre-existing) |
| `GOOGLE_CLIENT_SECRET` | Yes | Vercel env vars | Google SSO (pre-existing) |

---

## Best Practices

### Prompt Engineering

- All prompts request **JSON-only output** — no markdown, no explanation
- System prompts include w.v context (learning design consultancy, MEL, curriculum design)
- `parseJsonResponse()` strips markdown fences and trailing text as safety net
- Temperature: **0.7** for creative (email drafts), **0.2-0.3** for extraction (search, scoring)

### Error Handling

- All AI modules catch `JSON.parse` failures via `parseJsonResponse()`
- API routes return `500` with error message on AI failures
- Client components show error states (not silent failures)
- Budget check happens before every AI call
- Empty `response.content` array guarded in client

### Input Validation

- All API routes check auth (`session?.user?.email`)
- `contactIds` validated as string array
- `limit` clamped to 1-20
- Budget values validated (numeric, bounded 0-10000)
- Email composer confirms before overwriting user content

### Data Flow

```
User action → Client component → /api/ai/* route
  → auth check → budget check → lib/ai/*.ts module
    → fetch port context from Notion
    → callClaude() → parse response → record usage
  ← JSON response to client
```

### Token Tracking

Every AI call automatically:
1. Records `inputTokens`, `outputTokens`, `costUsd`, `feature`, `model`, `userId`, `durationMs`
2. Stores in `/tmp` (Vercel) with in-memory fallback
3. Accessible via `/api/ai/usage` and `/api/ai/costs`

**Known limitation:** Usage data is ephemeral on Vercel (resets on cold start). For persistent tracking, migrate to Vercel KV or a Notion database.

---

## Industry Comparison

Based on research of Attio, HubSpot, Salesforce Einstein, Clay, Folk, and Streak:

| Pattern | Industry Standard | w.v port |
|---------|-------------------|---------|
| Score badges on records | Salesforce Einstein (0-100) | Health badge on contacts |
| AI sidebar on record pages | HubSpot Breeze panel | Outreach card on orgs |
| Pipeline micro-nudges | Salesforce "Key Deals" | Nudge banner on pipeline |
| Inline content scoring | Mailchimp subject analyzer | Subject score in campaign steps |
| AI content generation | HubSpot slash commands | Template generate + email draft |
| Activity pattern detection | Streak auto-analysis | Activity insights (zero-cost) |
| Deal/opportunity scoring | Salesforce Einstein | Win probability on RFP cards |
| Natural language search | Attio "Ask Attio" | Global AI search bar |

### Design Principles (from industry leaders)

1. **Human-in-the-loop** — AI suggests, users accept/edit/ignore
2. **Context-aware, not context-switching** — AI appears where you already are
3. **Progressive disclosure** — simple badges inline, details on expand
4. **Visual differentiation** — sparkle icons mark AI-generated content
5. **Dual trigger model** — automatic for signals, on-demand for generation

---

## Future Roadmap

### Near-term
- [ ] Persistent usage tracking (Vercel KV or Notion database)
- [ ] Attio-style lilac cells for AI-generated data
- [ ] Folk-style follow-up detection (auto-detect stale conversations)
- [ ] Contact-aware email drafting (pass contactId)
- [ ] A/B subject line suggestions

### Medium-term
- [ ] Salesforce-style factor explanations (show *why* a score is what it is)
- [ ] HubSpot Breeze-style slash commands in text fields
- [ ] Campaign performance prediction
- [ ] Audience segment quality scoring
- [ ] Auto-enrichment on new org/contact creation

### Long-term
- [ ] Conversational AI sidebar (ask anything about port data)
- [ ] Meeting transcription → auto-log activities
- [ ] Multi-step AI workflows (Attio-style)
- [ ] Competitive intelligence from web research

---

## Development

```bash
# Run port locally
npm run dev:port         # starts on port 3005

# Type check
cd port && npx tsc --noEmit

# Build
npm run build:port

# Deploy
git push origin main    # auto-deploys to Vercel
```

### Adding a New AI Feature

1. Define types in `lib/ai/types.ts`
2. Create feature module in `lib/ai/your-feature.ts`
3. Create API route in `app/api/ai/your-feature/route.ts`
4. Create client component in `app/components/ai-your-feature.tsx`
5. Integrate into existing page/component
6. Feature automatically tracked via `callClaude()` → `recordUsage()`
