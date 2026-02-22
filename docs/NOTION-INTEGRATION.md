# Notion Integration Guide

This branch experiments with two approaches for syncing Package Builder content from Notion databases.

## Quick Links

| Approach | Demo Page | How It Works |
|----------|-----------|--------------|
| **Build-Time** | `/do-build-time/` | GitHub Actions fetches from Notion → generates JSON → page loads from JSON |
| **Client-Side** | `/do-client-side/` | Page loads → fetches from Notion via proxy → renders content |

---

## Comparison

| Feature | Build-Time | Client-Side |
|---------|------------|-------------|
| **Page load speed** | ⚡ Fast (static JSON) | 🐢 Slight delay (API call) |
| **Content freshness** | Requires rebuild | Always fresh |
| **Infrastructure** | GitHub Actions only | Needs proxy (Cloudflare Worker) |
| **API key security** | ✅ Server-side only | ✅ Hidden in proxy |
| **Offline support** | ✅ Works offline | ❌ Needs connection |
| **Complexity** | Low | Medium |

---

## Approach 1: Build-Time (Recommended)

### How It Works

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│   Notion    │────▶│ GitHub       │────▶│ Static JSON │
│  Databases  │     │ Actions      │     │    File     │
└─────────────┘     └──────────────┘     └─────────────┘
                           │
                           ▼
                    ┌─────────────┐
                    │  Package    │
                    │  Builder    │
                    └─────────────┘
```

### Setup Steps

1. **Create Notion Integration**
   - Go to https://www.notion.so/my-integrations
   - Create new integration → Copy the API key
   - Share your databases with the integration

2. **Add GitHub Secret**
   - Go to your repo → Settings → Secrets → Actions
   - Add `NOTION_API_KEY` with your integration token

3. **Trigger a Sync**
   - Push to `notion-integration` branch, OR
   - Go to Actions → "Sync Notion Content" → Run workflow

4. **Content Updates**
   - Edit content in Notion
   - Manually trigger the workflow, OR
   - Wait for next push, OR
   - Uncomment the schedule in `.github/workflows/sync-notion.yml`

### Files

- `.github/workflows/sync-notion.yml` - GitHub Actions workflow
- `scripts/fetch-notion.js` - Node script that calls Notion API
- `data/package-builder-content.json` - Generated content file
- `do-build-time/index.html` - Package Builder that loads from JSON

---

## Approach 2: Client-Side

### How It Works

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│   Browser   │────▶│ Cloudflare   │────▶│   Notion    │
│    (JS)     │◀────│   Worker     │◀────│    API      │
└─────────────┘     └──────────────┘     └─────────────┘
```

### Setup Steps

1. **Deploy the Proxy**
   - Go to https://workers.cloudflare.com
   - Create a new Worker
   - Paste code from `scripts/notion-proxy-worker.js`
   - Add environment variable: `NOTION_API_KEY`
   - Deploy and copy the URL

2. **Configure the Page**
   - Open `do-client-side/index.html`
   - Set `NOTION_PROXY_URL` to your worker URL

### Files

- `scripts/notion-proxy-worker.js` - Cloudflare Worker code
- `do-client-side/index.html` - Package Builder with live fetch

---

## Notion Database IDs

These are pre-configured in the scripts. Update if you create new databases:

| Database | ID |
|----------|-----|
| Quadrants | `cd46b216-0aa1-4bc9-bd95-85af0abe5245` |
| Outcomes | `e7ca178b-986a-4436-a869-554db20196f5` |
| Examples | `fd9ce109-2b4b-4a85-b0a5-04d21e04a51e` |

---

## My Recommendation

**Start with Build-Time.** It's simpler, faster, and doesn't require extra infrastructure. You can always add client-side later if you need real-time updates.

### When to use Build-Time:
- Content changes weekly or less
- You want the fastest possible page loads
- You don't want to manage a proxy

### When to use Client-Side:
- Content changes multiple times per day
- You need instant updates without rebuilding
- You're okay with a slight load delay

---

## Testing Locally

```bash
# Install dependencies
npm install @notionhq/client

# Set your API key
export NOTION_API_KEY="your_key_here"

# Run the fetch script
node scripts/fetch-notion.js

# Start a local server
npx serve .
```

Then visit:
- http://localhost:3000/do-build-time/
- http://localhost:3000/do-client-side/
