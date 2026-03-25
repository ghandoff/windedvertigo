#!/usr/bin/env node
/**
 * Creates the AI Integration Guide as a Notion page.
 *
 * Usage:
 *   NOTION_TOKEN=ntn_xxx node scripts/create-ai-guide-notion.mjs
 *
 * Or if you have .env.local with NOTION_TOKEN:
 *   node --env-file=crm/.env.local scripts/create-ai-guide-notion.mjs
 */

const NOTION_TOKEN = process.env.NOTION_TOKEN;
if (!NOTION_TOKEN) {
  console.error("Error: NOTION_TOKEN env var required");
  console.error("Usage: NOTION_TOKEN=ntn_xxx node scripts/create-ai-guide-notion.mjs");
  process.exit(1);
}

const headers = {
  Authorization: `Bearer ${NOTION_TOKEN}`,
  "Content-Type": "application/json",
  "Notion-Version": "2022-06-28",
};

// Helper to create rich text blocks
const text = (content) => [{ type: "text", text: { content } }];
const bold = (content) => [{ type: "text", text: { content }, annotations: { bold: true } }];
const code = (content) => [{ type: "text", text: { content }, annotations: { code: true } }];
const link = (content, url) => [{ type: "text", text: { content, link: { url } } }];

// Build the page content as Notion blocks
const children = [
  // Callout: Overview
  {
    type: "callout",
    callout: {
      rich_text: text("The w.v CRM at windedvertigo.com/crm has AI features powered by the Claude API, embedded throughout every major CRM surface — not isolated to a single page."),
      icon: { emoji: "🤖" },
    },
  },

  // Architecture
  { type: "heading_1", heading_1: { rich_text: text("Architecture") } },
  {
    type: "paragraph",
    paragraph: { rich_text: text("Stack: Next.js 16 + React 19 + Notion API + Anthropic Claude + Resend + shadcn/ui + Tailwind CSS + Vercel") },
  },
  {
    type: "code",
    code: {
      rich_text: text(`crm/
├── lib/ai/                    # AI core
│   ├── types.ts               # Types, cost model, feature definitions
│   ├── client.ts              # Claude API wrapper + token tracking + JSON parser
│   ├── usage-store.ts         # Usage logging, budget, cost breakdown
│   ├── email-draft.ts         # AI email generation
│   ├── nl-search.ts           # Natural language → CRM filters
│   ├── relationship-score.ts  # Contact health scoring
│   └── next-best-action.ts    # Follow-up recommendations
├── app/api/ai/                # 8 API endpoints
└── app/components/ai-*.tsx    # 8 AI-powered UI components`),
      language: "plain text",
    },
  },

  // Where AI Lives
  { type: "heading_1", heading_1: { rich_text: text("AI Features — Where They Live") } },
  { type: "heading_2", heading_2: { rich_text: text("Embedded in Existing Pages") } },

  // Feature table as bulleted list (Notion API tables are complex)
  {
    type: "numbered_list_item",
    numbered_list_item: { rich_text: [...bold("Health score badge"), ...text(" — Contact detail /contacts/[id] — On-demand — ~$0.002/call")] },
  },
  {
    type: "numbered_list_item",
    numbered_list_item: { rich_text: [...bold("Activity insights"), ...text(" — Contact detail /contacts/[id] — Auto (server render) — FREE")] },
  },
  {
    type: "numbered_list_item",
    numbered_list_item: { rich_text: [...bold("Outreach suggestions"), ...text(" — Org detail /organizations/[id] — On-demand — ~$0.04/call")] },
  },
  {
    type: "numbered_list_item",
    numbered_list_item: { rich_text: [...bold("Pipeline nudges"), ...text(" — Pipeline / — On-demand — ~$0.04/call")] },
  },
  {
    type: "numbered_list_item",
    numbered_list_item: { rich_text: [...bold("Subject line score"), ...text(" — Campaign step editor — Auto (debounced) — ~$0.001/call")] },
  },
  {
    type: "numbered_list_item",
    numbered_list_item: { rich_text: [...bold("AI template generate"), ...text(" — Template form (campaigns) — On-demand — ~$0.014/call")] },
  },
  {
    type: "numbered_list_item",
    numbered_list_item: { rich_text: [...bold("Win probability"), ...text(" — RFP radar — Auto (formula) — FREE")] },
  },
  {
    type: "numbered_list_item",
    numbered_list_item: { rich_text: [...bold("Global AI search"), ...text(" — All dashboard pages (top nav) — On-demand — ~$0.002/call")] },
  },
  {
    type: "numbered_list_item",
    numbered_list_item: { rich_text: [...bold("AI email draft"), ...text(" — Email composer /email — On-demand — ~$0.014/call")] },
  },
  {
    type: "numbered_list_item",
    numbered_list_item: { rich_text: [...bold("Tone/purpose selectors"), ...text(" — Email composer /email — UI selection — —")] },
  },

  { type: "heading_2", heading_2: { rich_text: text("Standalone Page") } },
  {
    type: "bulleted_list_item",
    bulleted_list_item: { rich_text: [...bold("AI Hub"), ...text(" at /ai-hub — Token economics, usage analytics, budget controls, full cost breakdown")] },
  },

  // Cost Model
  { type: "heading_1", heading_1: { rich_text: text("Cost Model") } },
  { type: "heading_2", heading_2: { rich_text: text("Per-Feature Cost Estimates") } },
  {
    type: "bulleted_list_item",
    bulleted_list_item: { rich_text: [...bold("Email Draft"), ...text(" (Sonnet) — ~$0.014/call")] },
  },
  {
    type: "bulleted_list_item",
    bulleted_list_item: { rich_text: [...bold("NL Search"), ...text(" (Haiku) — ~$0.002/call")] },
  },
  {
    type: "bulleted_list_item",
    bulleted_list_item: { rich_text: [...bold("Health Score"), ...text(" (Haiku) — ~$0.002/call")] },
  },
  {
    type: "bulleted_list_item",
    bulleted_list_item: { rich_text: [...bold("Next Actions"), ...text(" (Sonnet) — ~$0.038/call")] },
  },
  {
    type: "bulleted_list_item",
    bulleted_list_item: { rich_text: [...bold("Subject Score"), ...text(" (Haiku) — ~$0.001/call")] },
  },

  { type: "heading_2", heading_2: { rich_text: text("Model Selection") } },
  {
    type: "bulleted_list_item",
    bulleted_list_item: { rich_text: [...bold("Sonnet"), ...text(" — creative generation: email drafts, action recommendations")] },
  },
  {
    type: "bulleted_list_item",
    bulleted_list_item: { rich_text: [...bold("Haiku"), ...text(" — fast extraction: search parsing, scoring, classification")] },
  },

  { type: "heading_2", heading_2: { rich_text: text("Budget Controls") } },
  {
    type: "bulleted_list_item",
    bulleted_list_item: { rich_text: text("Default: $50/month (configurable in AI Hub)") },
  },
  {
    type: "bulleted_list_item",
    bulleted_list_item: { rich_text: text("Warning at 80% spend") },
  },
  {
    type: "bulleted_list_item",
    bulleted_list_item: { rich_text: text("Auto-pause all AI features when budget exceeded (429 responses)") },
  },

  // Zero-Cost Features
  { type: "heading_1", heading_1: { rich_text: text("Zero-Cost Features (No API Calls)") } },
  {
    type: "numbered_list_item",
    numbered_list_item: { rich_text: [...bold("Activity pattern detection"), ...text(" — days since last contact, outcome ratios, response timing, frequency")] },
  },
  {
    type: "numbered_list_item",
    numbered_list_item: { rich_text: [...bold("Win probability"), ...text(" — formula: base(30) + fitScore(0-25) + serviceMatch(0-15) + statusProgression(0-15)")] },
  },

  // Best Practices
  { type: "heading_1", heading_1: { rich_text: text("Best Practices") } },
  { type: "heading_2", heading_2: { rich_text: text("Design Principles") } },
  {
    type: "numbered_list_item",
    numbered_list_item: { rich_text: [...bold("Human-in-the-loop"), ...text(" — AI suggests, users accept/edit/ignore")] },
  },
  {
    type: "numbered_list_item",
    numbered_list_item: { rich_text: [...bold("Context-aware"), ...text(" — AI appears where you already are, not on a separate page")] },
  },
  {
    type: "numbered_list_item",
    numbered_list_item: { rich_text: [...bold("Progressive disclosure"), ...text(" — simple badges inline, details on expand/click")] },
  },
  {
    type: "numbered_list_item",
    numbered_list_item: { rich_text: [...bold("Visual differentiation"), ...text(" — sparkle icons mark AI-generated content")] },
  },
  {
    type: "numbered_list_item",
    numbered_list_item: { rich_text: [...bold("Dual trigger model"), ...text(" — automatic for signals, on-demand for generation")] },
  },

  { type: "heading_2", heading_2: { rich_text: text("Error Handling") } },
  {
    type: "bulleted_list_item",
    bulleted_list_item: { rich_text: text("All AI modules use parseJsonResponse() which strips markdown fences from LLM output") },
  },
  {
    type: "bulleted_list_item",
    bulleted_list_item: { rich_text: text("API routes return 500 with error message on AI failures") },
  },
  {
    type: "bulleted_list_item",
    bulleted_list_item: { rich_text: text("Client components show error states (not silent failures)") },
  },
  {
    type: "bulleted_list_item",
    bulleted_list_item: { rich_text: text("Budget check happens before every AI call") },
  },

  // Industry Comparison
  { type: "heading_1", heading_1: { rich_text: text("Industry Comparison") } },
  { type: "paragraph", paragraph: { rich_text: text("Based on research of Attio, HubSpot, Salesforce Einstein, Clay, Folk, and Streak:") } },
  {
    type: "bulleted_list_item",
    bulleted_list_item: { rich_text: [...bold("Score badges"), ...text(" — Salesforce Einstein (0-100) → w.v Health badge on contacts")] },
  },
  {
    type: "bulleted_list_item",
    bulleted_list_item: { rich_text: [...bold("AI sidebar on records"), ...text(" — HubSpot Breeze panel → w.v Outreach card on orgs")] },
  },
  {
    type: "bulleted_list_item",
    bulleted_list_item: { rich_text: [...bold("Pipeline nudges"), ...text(" — Salesforce 'Key Deals' → w.v Nudge banner on pipeline")] },
  },
  {
    type: "bulleted_list_item",
    bulleted_list_item: { rich_text: [...bold("Content scoring"), ...text(" — Mailchimp subject analyzer → w.v Subject score in steps")] },
  },
  {
    type: "bulleted_list_item",
    bulleted_list_item: { rich_text: [...bold("NL search"), ...text(" — Attio 'Ask Attio' → w.v Global AI search bar")] },
  },
  {
    type: "bulleted_list_item",
    bulleted_list_item: { rich_text: [...bold("Deal scoring"), ...text(" — Salesforce Einstein → w.v Win probability on RFP cards")] },
  },

  // Environment Variables
  { type: "heading_1", heading_1: { rich_text: text("Environment Variables") } },
  {
    type: "bulleted_list_item",
    bulleted_list_item: { rich_text: [...code("ANTHROPIC_API_KEY"), ...text(" — Claude API authentication (Vercel env vars)")] },
  },
  {
    type: "bulleted_list_item",
    bulleted_list_item: { rich_text: [...code("NOTION_TOKEN"), ...text(" — Notion database access (pre-existing)")] },
  },

  // Future Roadmap
  { type: "heading_1", heading_1: { rich_text: text("Future Roadmap") } },
  { type: "heading_2", heading_2: { rich_text: text("Near-term") } },
  { type: "to_do", to_do: { rich_text: text("Persistent usage tracking (Vercel KV or Notion database)"), checked: false } },
  { type: "to_do", to_do: { rich_text: text("Attio-style lilac cells for AI-generated data"), checked: false } },
  { type: "to_do", to_do: { rich_text: text("Folk-style follow-up detection (auto-detect stale conversations)"), checked: false } },
  { type: "to_do", to_do: { rich_text: text("Contact-aware email drafting (pass contactId)"), checked: false } },
  { type: "to_do", to_do: { rich_text: text("A/B subject line suggestions"), checked: false } },

  { type: "heading_2", heading_2: { rich_text: text("Medium-term") } },
  { type: "to_do", to_do: { rich_text: text("Salesforce-style factor explanations (show why a score is what it is)"), checked: false } },
  { type: "to_do", to_do: { rich_text: text("HubSpot Breeze-style slash commands in text fields"), checked: false } },
  { type: "to_do", to_do: { rich_text: text("Campaign performance prediction"), checked: false } },
  { type: "to_do", to_do: { rich_text: text("Auto-enrichment on new org/contact creation"), checked: false } },

  { type: "heading_2", heading_2: { rich_text: text("Long-term") } },
  { type: "to_do", to_do: { rich_text: text("Conversational AI sidebar (ask anything about CRM data)"), checked: false } },
  { type: "to_do", to_do: { rich_text: text("Meeting transcription → auto-log activities"), checked: false } },
  { type: "to_do", to_do: { rich_text: text("Multi-step AI workflows (Attio-style)"), checked: false } },
  { type: "to_do", to_do: { rich_text: text("Competitive intelligence from web research"), checked: false } },

  // Source
  { type: "divider", divider: {} },
  {
    type: "paragraph",
    paragraph: {
      rich_text: [
        ...text("Source: "),
        ...code("crm/AI-GUIDE.md"),
        ...text(" in the windedvertigo repo. Last updated: 2026-03-25."),
      ],
    },
  },
];

async function searchForParentPage() {
  // Search for a page to use as parent — look for "CRM" or workspace root
  const res = await fetch("https://api.notion.com/v1/search", {
    method: "POST",
    headers,
    body: JSON.stringify({
      query: "CRM",
      filter: { value: "page", property: "object" },
      page_size: 5,
    }),
  });
  const data = await res.json();
  // Return first matching page, or null
  if (data.results?.length > 0) {
    return data.results[0].id;
  }
  return null;
}

async function createPage(parentPageId) {
  const body = {
    parent: parentPageId
      ? { page_id: parentPageId }
      : { type: "page_id", page_id: parentPageId }, // fallback
    icon: { emoji: "🤖" },
    properties: {
      title: [{ text: { content: "w.v CRM — AI Integration Guide" } }],
    },
    children,
  };

  const res = await fetch("https://api.notion.com/v1/pages", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.json();
    console.error("Failed to create page:", JSON.stringify(err, null, 2));
    process.exit(1);
  }

  return await res.json();
}

async function main() {
  console.log("Searching for parent page...");
  let parentId = await searchForParentPage();

  if (parentId) {
    console.log(`Found parent page: ${parentId}`);
  } else {
    console.log("No 'CRM' page found. Creating at workspace root...");
    // Create as a standalone page (no parent = workspace root)
    // The Notion API requires a parent — use the search to find any page
    const rootSearch = await fetch("https://api.notion.com/v1/search", {
      method: "POST",
      headers,
      body: JSON.stringify({ page_size: 1 }),
    });
    const rootData = await rootSearch.json();
    if (rootData.results?.length > 0) {
      parentId = rootData.results[0].id;
    } else {
      console.error("No pages found in workspace. Cannot create page.");
      process.exit(1);
    }
  }

  console.log("Creating AI Guide page...");
  const page = await createPage(parentId);
  const url = page.url;
  console.log(`\n✅ Page created successfully!`);
  console.log(`📄 URL: ${url}\n`);
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
