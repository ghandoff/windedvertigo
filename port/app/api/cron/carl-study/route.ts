/**
 * cARL scheduled study — advances the curriculum a few topics at a time.
 *
 * For each planned curriculum topic, asks Claude (as cARL) to synthesise one
 * distilled finding from the established literature, logs it to cARL's library,
 * files the cited source into the canonical Annotated Bibliography, and marks
 * the topic covered. Token usage auto-logs to ai_usage_logs under "carl-study"
 * (visible on /ai-hub and the cARL dashboard).
 *
 * v1 draws on training knowledge only. Web search (real, fresh citations) is the
 * additive next step — see the note below; it needs Anthropic's web_search tool,
 * which may require bypassing the AI-gateway base URL.
 */

import { NextRequest } from "next/server";
import { json, error, param } from "@/lib/api-helpers";
import { callClaude, parseJsonResponse } from "@/lib/ai/client";
import { insertCarlFinding } from "@/lib/supabase/carl";
import { getCurriculum, updateCurriculumTopic } from "@/lib/supabase/carl-curriculum";
import { createBibliographyEntry } from "@/lib/notion/bibliography";

// how many topics to study per run — keep modest (cheap + within worker time)
const TOPICS_PER_RUN = 3;

// authorised by the scheduler (CRON_SECRET) OR an admin/agent (CMO_API_TOKEN),
// so a study run can be triggered on demand to watch the curriculum fill in.
function verifyAuth(req: NextRequest): boolean {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return false;
  return token === process.env.CRON_SECRET || token === process.env.CMO_API_TOKEN;
}

const SYSTEM = `you are cARL, winded.vertigo's research librarian and scholar. winded.vertigo is a regenerative-education collective that builds learning apps (the "harbour" apps), facilitation designs, and grant proposals.

given ONE curriculum topic, produce a single distilled research finding drawn from the established literature. be accurate — cite a real, well-known work. write in plain language with british spelling, lowercase, an oxford comma.

return ONLY json, no prose, in this exact shape:
{
  "title": "a clear, specific finding title",
  "summary": "1–3 sentences distilling the core insight",
  "relevance": "one sentence on how this helps w.v's learning apps, facilitation, or proposals",
  "citation": "a key source — author(s), title, year",
  "tags": ["lowercase", "short", "tags"]
}`;

export async function GET(req: NextRequest) {
  if (!verifyAuth(req)) return error("unauthorized", 401);

  try {
    // scheduled runs do TOPICS_PER_RUN; a manual trigger can pass ?count=N (capped)
    const count = Math.min(Math.max(Number(param(req, "count")) || TOPICS_PER_RUN, 1), 12);
    const planned = await getCurriculum({ status: "planned" });
    const batch = planned
      .sort((a, b) => a.priority - b.priority || a.sort_order - b.sort_order)
      .slice(0, count);

    if (batch.length === 0) {
      return json({ studied: 0, note: "curriculum fully covered — nothing planned" });
    }

    let costUsd = 0;
    const studied: { domain: string; topic: string; title: string }[] = [];

    for (const t of batch) {
      try {
        const res = await callClaude({
          feature: "carl-study",
          userId: "carl-automation",
          system: SYSTEM,
          userMessage: `domain: ${t.domain}\ntopic: ${t.topic}\nkey works to draw on: ${(t.key_works ?? []).join("; ") || "(use your knowledge of the canonical literature)"}`,
          maxTokens: 700,
          temperature: 0.3,
        });
        costUsd += res.costUsd;

        const f = parseJsonResponse<{
          title: string;
          summary: string;
          relevance?: string;
          citation?: string;
          tags?: string[];
        }>(res.text);

        await insertCarlFinding({
          domain: t.domain,
          title: f.title,
          summary: f.summary,
          relevance: f.relevance,
          citation: f.citation,
          tags: Array.isArray(f.tags) ? f.tags : [],
          source: "cARL scheduled study",
        });

        // file the cited source into the annotated bibliography (de-duped, never throws)
        if (f.citation) {
          await createBibliographyEntry({
            fullCitation: f.citation,
            abstract: f.summary,
            notes: f.relevance,
            keywords: Array.isArray(f.tags) ? f.tags.join(", ") : undefined,
            topic: t.domain,
            sourceType: "cARL finding",
          });
        }

        await updateCurriculumTopic(t.id, { status: "covered" });
        studied.push({ domain: t.domain, topic: t.topic, title: f.title });
      } catch (perTopic) {
        // one bad topic shouldn't sink the run; leave it planned for next time
        console.error(`[cron/carl-study] topic failed (${t.domain} · ${t.topic}):`, perTopic);
      }
    }

    return json({
      studied: studied.length,
      remaining_planned: planned.length - studied.length,
      cost_usd: Number(costUsd.toFixed(4)),
      findings: studied,
    });
  } catch (err) {
    console.error("[cron/carl-study] run failed:", err);
    return error("carl-study run failed", 500);
  }
}
