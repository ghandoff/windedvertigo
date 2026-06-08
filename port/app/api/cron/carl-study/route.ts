/**
 * cARL scheduled study — advances the curriculum a few topics at a time.
 *
 * For each planned curriculum topic, cARL now SEARCHES the live academic
 * literature (Crossref, OpenAlex, Semantic Scholar, PubMed, arXiv, CORE via
 * searchScholar) for real papers on the topic, then asks Claude to choose the
 * most relevant result(s) and distil a finding grounded in them. The chosen
 * real article(s) are filed into the Annotated Bibliography with structured
 * fields (authors, journal, DOI, OA-PDF link → PDF retrievable, sortable), and
 * the finding lands in cARL's library. If a topic returns no hits, it falls
 * back to synthesising from training knowledge so the run still progresses.
 *
 * After the run, the per-provider hit-counts are recorded to cARL's memory
 * (key: retrieval-source-notes) so patterns of which sources serve which
 * domains accumulate over time — the seed of "learning to strengthen the tool".
 *
 * Token usage auto-logs to ai_usage_logs under "carl-study" (visible on
 * /ai-hub and the cARL dashboard).
 */

import { NextRequest } from "next/server";
import { json, error, param } from "@/lib/api-helpers";
import { callClaude, parseJsonResponse } from "@/lib/ai/client";
import { insertCarlFinding, upsertCarlMemory } from "@/lib/supabase/carl";
import { getCurriculum, updateCurriculumTopic } from "@/lib/supabase/carl-curriculum";
import { createBibliographyEntry } from "@/lib/notion/bibliography";
import { insertBibliographyRow } from "@/lib/supabase/bibliography";
import { searchScholar } from "@/lib/bibliography/scholar";
import type { ScholarHit } from "@/lib/bibliography/scholar/types";

// how many topics to study per run — keep modest (cheap + within worker time)
const TOPICS_PER_RUN = 3;

function verifyAuth(req: NextRequest): boolean {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return false;
  return token === process.env.CRON_SECRET || token === process.env.CMO_API_TOKEN;
}

// search-grounded prompt: pick from REAL results, ground the finding in them
const SYSTEM_SEARCH = `you are cARL, winded.vertigo's research librarian and scholar. winded.vertigo is a regenerative-education collective that builds learning apps (the "harbour" apps), facilitation designs, and grant proposals.

you are given ONE curriculum topic and a numbered list of REAL search results from the academic literature. choose the most relevant result (or two), and write a single distilled finding grounded in them. do not invent sources — only cite from the list. write in plain language with british spelling, lowercase, an oxford comma.

return ONLY json, no prose, in this exact shape:
{
  "title": "a clear, specific finding title",
  "summary": "1–3 sentences distilling the core insight from the chosen source(s)",
  "relevance": "one sentence on how this helps w.v's learning apps, facilitation, or proposals",
  "tags": ["lowercase", "short", "tags"],
  "chosen": [0]
}
where "chosen" is an array of the result index numbers you used (e.g. [0] or [0, 2]).`;

// fallback prompt: no search hits — synthesise from established knowledge
const SYSTEM_KNOWLEDGE = `you are cARL, winded.vertigo's research librarian and scholar. winded.vertigo is a regenerative-education collective that builds learning apps, facilitation designs, and grant proposals.

given ONE curriculum topic, produce a single distilled research finding drawn from the established literature. be accurate — cite a real, well-known work. write in plain language with british spelling, lowercase, an oxford comma.

return ONLY json, no prose, in this exact shape:
{
  "title": "a clear, specific finding title",
  "summary": "1–3 sentences distilling the core insight",
  "relevance": "one sentence on how this helps w.v's learning apps, facilitation, or proposals",
  "citation": "a key source — author(s), title, year",
  "tags": ["lowercase", "short", "tags"]
}`;

interface FindingJson {
  title: string;
  summary: string;
  relevance?: string;
  citation?: string;
  tags?: string[];
  chosen?: number[];
}

/** File a real search hit into the bibliography with structured fields. */
async function fileHit(hit: ScholarHit, topicDomain: string) {
  const doiUrl = hit.doi ? `https://doi.org/${hit.doi}` : hit.url ?? null;
  await insertBibliographyRow({
    fullCitation: hit.fullCitation ?? `${hit.authors.join(", ")} (${hit.year ?? "n.d."}). ${hit.title}.`,
    year: hit.year ?? null,
    doi: doiUrl,
    sourceType: "cARL finding",
    abstract: hit.abstract ?? undefined,
    publisherLink: doiUrl,
    scholarLink: hit.openAccessPdf ?? null, // tier-1 source for PDF retrieval
    citationCount: hit.citationCount ?? null,
    topic: topicDomain,
    authors: hit.authors?.length ? hit.authors : null,
    firstAuthor: hit.authors?.[0] ?? null,
    journal: hit.venue ?? null,
  });
}

export async function GET(req: NextRequest) {
  if (!verifyAuth(req)) return error("unauthorized", 401);

  try {
    const count = Math.min(Math.max(Number(param(req, "count")) || TOPICS_PER_RUN, 1), 12);
    const planned = await getCurriculum({ status: "planned" });
    const batch = planned
      .sort((a, b) => a.priority - b.priority || a.sort_order - b.sort_order)
      .slice(0, count);

    if (batch.length === 0) {
      return json({ studied: 0, note: "curriculum fully covered — nothing planned" });
    }

    let costUsd = 0;
    const studied: { domain: string; topic: string; title: string; grounded: boolean; filed: number }[] = [];
    const providerTally: Record<string, number> = {};
    const studiedDomains = new Set<string>();

    for (const t of batch) {
      try {
        // 1. search the live literature for this topic
        const queryStr = `${t.topic} ${(t.key_works ?? []).join(" ")}`.trim();
        const search = await searchScholar(queryStr, { limitPerProvider: 4, timeoutMs: 9000 })
          .catch(() => ({ hits: [] as ScholarHit[], providers: [], errors: [] }));
        for (const p of search.providers) providerTally[p.id] = (providerTally[p.id] ?? 0) + p.count;
        const topHits = search.hits.slice(0, 6);

        let f: FindingJson;
        let chosen: ScholarHit[] = [];
        let grounded = false;

        if (topHits.length > 0) {
          // 2a. ground the finding in real results
          const list = topHits
            .map((h, i) => {
              const cite = h.fullCitation ?? `${h.authors.join(", ")} (${h.year ?? "n.d."}). ${h.title}.`;
              const meta = [
                h.citationCount != null ? `cited by ${h.citationCount}` : null,
                h.openAccessPdf ? "OA pdf" : null,
              ].filter(Boolean).join(" · ");
              return `[${i}] ${cite}${meta ? ` · ${meta}` : ""}`;
            })
            .join("\n");
          const res = await callClaude({
            feature: "carl-study",
            userId: "carl-automation",
            system: SYSTEM_SEARCH,
            userMessage: `domain: ${t.domain}\ntopic: ${t.topic}\n\nreal search results:\n${list}\n\nchoose the most relevant result(s) and write the finding.`,
            maxTokens: 700,
            temperature: 0.3,
          });
          costUsd += res.costUsd;
          f = parseJsonResponse<FindingJson>(res.text);
          const idxs = Array.isArray(f.chosen)
            ? f.chosen.filter((i) => Number.isInteger(i) && i >= 0 && i < topHits.length)
            : [];
          chosen = (idxs.length ? idxs : [0]).map((i) => topHits[i]);
          grounded = true;
        } else {
          // 2b. fallback — synthesise from training knowledge
          const res = await callClaude({
            feature: "carl-study",
            userId: "carl-automation",
            system: SYSTEM_KNOWLEDGE,
            userMessage: `domain: ${t.domain}\ntopic: ${t.topic}\nkey works to draw on: ${(t.key_works ?? []).join("; ") || "(use your knowledge of the canonical literature)"}`,
            maxTokens: 700,
            temperature: 0.3,
          });
          costUsd += res.costUsd;
          f = parseJsonResponse<FindingJson>(res.text);
        }

        // 3. file the finding into cARL's library
        const findingCitation = chosen[0]?.fullCitation ?? f.citation;
        await insertCarlFinding({
          domain: t.domain,
          title: f.title,
          summary: f.summary,
          relevance: f.relevance,
          citation: findingCitation,
          tags: Array.isArray(f.tags) ? f.tags : [],
          source: grounded ? "cARL scheduled study (search-grounded)" : "cARL scheduled study",
        });

        // 4. file the source(s) into the bibliography
        let filed = 0;
        if (chosen.length > 0) {
          for (const h of chosen) {
            await fileHit(h, t.domain).then(() => { filed++; }).catch(() => {});
          }
        } else if (f.citation) {
          // fallback path: bare citation string (Crossref-enriches if a DOI is present)
          await createBibliographyEntry({
            fullCitation: f.citation,
            abstract: f.summary,
            notes: f.relevance,
            keywords: Array.isArray(f.tags) ? f.tags.join(", ") : undefined,
            topic: t.domain,
            sourceType: "cARL finding",
          });
          filed = 1;
        }

        await updateCurriculumTopic(t.id, { status: "covered" });
        studiedDomains.add(t.domain);
        studied.push({ domain: t.domain, topic: t.topic, title: f.title, grounded, filed });
      } catch (perTopic) {
        console.error(`[cron/carl-study] topic failed (${t.domain} · ${t.topic}):`, perTopic);
      }
    }

    // 5. record provider efficacy to memory — the "learning about sources" loop
    if (Object.keys(providerTally).length > 0) {
      const tally = Object.entries(providerTally)
        .sort((a, b) => b[1] - a[1])
        .map(([id, n]) => `${id}: ${n}`)
        .join(" · ");
      await upsertCarlMemory(
        "retrieval-source-notes",
        `last study run (${studied.length} topics across ${[...studiedDomains].join(", ") || "—"}): provider hit-counts — ${tally}. low/zero counts for a domain suggest a source gap worth flagging under 'source-suggestions'.`,
        "carl-automation",
      ).catch(() => {});
    }

    return json({
      studied: studied.length,
      grounded: studied.filter((s) => s.grounded).length,
      sources_filed: studied.reduce((n, s) => n + s.filed, 0),
      remaining_planned: planned.length - studied.length,
      provider_hits: providerTally,
      cost_usd: Number(costUsd.toFixed(4)),
      findings: studied,
    });
  } catch (err) {
    console.error("[cron/carl-study] run failed:", err);
    return error("carl-study run failed", 500);
  }
}
