# Dispatch: tidal.pool Notion Setup

> **Priority:** Run immediately on next Cowork session
> **Status:** Pending
> **Requires:** Notion MCP
> **Created:** 2026-04-03 by Claude Code

## What to do

Execute the following three Notion operations using the Notion MCP tools.

### 1. Create "tidal.pool Elements" database

Create a new database in the workspace (same parent as the harbour games DB) with these properties:

| Property | Type | Options |
|----------|------|---------|
| Name | title | — |
| Slug | text | — |
| Category | select | `natural`, `environmental`, `economic`, `social` |
| Icon | text | — |
| Description | rich_text | — |
| Default Value | number | — |
| Color | text | — |
| Order | number | — |
| Status | select | `live`, `draft` |

**After creation, record the database ID.**

Then seed it with these 14 elements:

| Name | Slug | Category | Icon | Default Value | Color |
|------|------|----------|------|---------------|-------|
| rainfall | rainfall | natural | 🌧️ | 50 | #3B82F6 |
| sunlight | sunlight | natural | ☀️ | 60 | #F59E0B |
| soil health | soil-health | natural | 🌱 | 50 | #84CC16 |
| biodiversity | biodiversity | natural | 🦋 | 50 | #14B8A6 |
| pollution | pollution | environmental | 🏭 | 20 | #6B7280 |
| temperature | temperature | environmental | 🌡️ | 50 | #EF4444 |
| water quality | water-quality | environmental | 💧 | 60 | #06B6D4 |
| crop yield | crop-yield | economic | 🌾 | 40 | #22C55E |
| market price | market-price | economic | 💰 | 50 | #A855F7 |
| investment | investment | economic | 📈 | 30 | #EC4899 |
| population | population | social | 👥 | 50 | #F97316 |
| education | education | social | 📚 | 40 | #8B5CF6 |
| wellbeing | wellbeing | social | ❤️ | 50 | #F43F5E |
| cooperation | cooperation | social | 🤝 | 50 | #0EA5E9 |

Set all to Status: `live`, Order: sequential starting at 1.

### 2. Create "tidal.pool Scenarios" database

Create a new database with these properties:

| Property | Type | Options |
|----------|------|---------|
| Name | title | — |
| Slug | text | — |
| Description | rich_text | — |
| Difficulty | select | `explore`, `challenge`, `complex` |
| Challenge Prompt | rich_text | — |
| Skills | multi_select | `systems-thinking`, `cause-and-effect`, `complexity`, `feedback-loops`, `emergence`, `interconnection` |
| Preset Connections | rich_text | (will hold JSON) |
| Status | select | `live`, `draft`, `coming-soon` |
| Order | number | — |

**After creation, record the database ID.**

Then seed with one starter scenario:

- **Name:** the fishing village
- **Slug:** fishing-village
- **Description:** a small coastal village depends on fishing for its economy. but the fish population, water quality, and village growth are all connected. can you keep the system in balance?
- **Difficulty:** explore
- **Challenge Prompt:** keep the fish population above 30 for 50 ticks while the village population grows.
- **Skills:** systems-thinking, cause-and-effect, feedback-loops
- **Status:** live
- **Order:** 1

### 3. Add tidal.pool to harbour games database

Add a new page to the existing harbour games DB (ID: `8e3f3364b2654640a91ed0f38b091a07`):

| Property | Value |
|----------|-------|
| Name | tidal.pool |
| Slug | tidal-pool |
| Tagline | a systems thinking sandbox |
| Description | drop elements into the pool, draw connections between them, and watch how everything affects everything else. explore feedback loops, cause-and-effect, and the interconnectedness of everything. |
| Icon | 🌊 |
| Brand Color | from-blue-900 to-cyan-800 |
| Accent Color | bg-cyan-600 |
| Features | systems thinking, feedback loops, cause and effect, emergence, interconnection |
| Href | /harbour/tidal-pool |
| Status | coming-soon |
| Order | 6 |

## After completion

1. **Report the two new database IDs** (Elements DB and Scenarios DB) — these need to be added as env vars on the tidal-pool Vercel project:
   - `NOTION_TIDAL_POOL_ELEMENTS_DB_ID`
   - `NOTION_TIDAL_POOL_SCENARIOS_DB_ID`

2. **Update `.brain/TASKS.md`** — mark the Notion database tasks as complete.

3. **Post to Slack** — brief summary: "tidal.pool Notion databases created and seeded. harbour games entry added (coming-soon). DB IDs: [elements], [scenarios]."
