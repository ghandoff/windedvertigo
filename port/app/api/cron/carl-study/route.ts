/**
 * cARL scheduled study — the collective's lifelong-learning engine.
 *
 * Runs DAILY (lib/scheduled.ts). Each run takes a batch of planned curriculum
 * topics and, for each, SEARCHES the live academic literature (searchScholar),
 * grounds an ambitious finding in real results, files the source(s) into the
 * Annotated Bibliography with structured fields (authors, journal, DOI, title,
 * OA-pdf → sortable + PDF-retrievable), and logs the finding to cARL's library.
 * If a topic returns no hits, it falls back to synthesising from established
 * knowledge so the run still progresses.
 *
 * cARL serves three tracks, by curriculum `domain` prefix:
 *   - collective  → strengthens the harbour apps, facilitation, proposals
 *   - "mo · …"     → develops Mo (CMO; MBA/PhD — strategy, marketing science, cases)
 *   - "pam · …"    → develops Pam (PM craft — estimation, dependencies, momentum)
 * Findings for Mo/Pam are delivered into their memory (cmo_memory/pam_memory,
 * key carl-insight-*) so they surface on their dashboards.
 *
 * Self-replenishing: when the planned queue runs low, cARL proposes new topics
 * across all three tracks so daily study never stalls.
 *
 * Triggerable by the scheduler (CRON_SECRET), an agent (CMO_API_TOKEN), or a
 * logged-in user (the /carl "run a study now" button). Token usage logs under
 * "carl-study" (visible on /ai-hub and the cARL dashboard).
 */

import { NextRequest } from "next/server";
import { json, error, param } from "@/lib/api-helpers";
import { auth } from "@/lib/auth";
import { callClaude, parseJsonResponse } from "@/lib/ai/client";
import { insertCarlFinding, upsertCarlMemory } from "@/lib/supabase/carl";
import { getCurriculum, updateCurriculumTopic, insertCarlCurriculumTopic } from "@/lib/supabase/carl-curriculum";
import { upsertCmoMemory } from "@/lib/supabase/cmo";
import { upsertPamMemory } from "@/lib/supabase/pam";
import { createBibliographyEntry } from "@/lib/notion/bibliography";
import { insertBibliographyRow } from "@/lib/supabase/bibliography";
import { searchScholar } from "@/lib/bibliography/scholar";
import type { ScholarHit } from "@/lib/bibliography/scholar/types";
import { postToChannel } from "@/lib/slack";

// go-big daily volume; manual ?count can override up to the cap
const TOPICS_PER_RUN = 20;
const COUNT_CAP = 40;
// keep the queue full: replenish when fewer than this remain planned
const REPLENISH_BELOW = 15;

function hasTokenAuth(req: NextRequest): boolean {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return false;
  return token === process.env.CRON_SECRET || token === process.env.CMO_API_TOKEN;
}
async function isLoggedIn(): Promise<boolean> {
  try {
    const session = await auth();
    return !!session?.user;
  } catch {
    return false;
  }
}

// ── prompts ───────────────────────────────────────────────────────────────────

const SYSTEM_SEARCH = `you are cARL, winded.vertigo's research librarian and lifelong-learning engine. winded.vertigo is a regenerative-education collective that builds learning apps (the "harbour" apps), facilitation designs, and grant proposals. you also actively develop two colleagues: mo (our cmo, pursuing an mba/phd — business strategy, marketing science, case studies) and pam (our pm — project craft, estimation, team momentum).

you are given ONE topic, its audience, and a numbered list of REAL search results from the academic literature. be ambitious and rigorous: lean on the results, choose the most relevant (one or two), and write a single sharp finding grounded in them. do not invent sources — cite only from the list. plain language, british spelling, lowercase, an oxford comma.

frame the finding for its audience:
- audience "mo": write it as a business / case-study teaching note mo can learn from for her mba/phd and marketing craft.
- audience "pam": write it as a pm-craft technique pam can apply to how we run projects.
- audience "collective": connect it to what we're building — apps, facilitation, proposals.

return ONLY json, no prose:
{
  "title": "a clear, specific finding title",
  "summary": "1–3 sentences distilling the core insight from the chosen source(s)",
  "relevance": "one sentence on how this helps the audience",
  "tags": ["lowercase", "short", "tags"],
  "chosen": [0]
}
where "chosen" is the result index number(s) you used (e.g. [0] or [0, 2]).`;

const SYSTEM_KNOWLEDGE = `you are cARL, winded.vertigo's research librarian and lifelong-learning engine — serving the collective and developing mo (cmo, mba/phd) and pam (pm craft).

given ONE topic and its audience, produce a single distilled finding drawn from the established literature. be accurate — cite a real, well-known work. frame it for the audience (mo = business/case-study lens; pam = pm-craft lens; collective = our apps/facilitation/proposals). plain language, british spelling, lowercase, an oxford comma.

return ONLY json, no prose:
{
  "title": "...",
  "summary": "1–3 sentences",
  "relevance": "one sentence on how this helps the audience",
  "citation": "a key source — author(s), title, year",
  "tags": ["...", "..."]
}`;

const SYSTEM_REPLENISH = `you are cARL, winded.vertigo's research librarian and lifelong-learning engine. propose NEW study topics to keep your curriculum full, spread across three tracks:
- collective: learning sciences, curriculum design, ed-tech, facilitation, threshold concepts, play-based learning, UDL, assessment — whatever strengthens the harbour apps and proposals.
- mo: business strategy, marketing science, brand, pricing, positioning, go-to-market, and mba/phd-level case studies.
- pam: project-management craft — estimation, dependencies, risk, team momentum, agile/lean.

use a "domain" prefix of "mo · <area>" for mo topics and "pam · <area>" for pam topics; collective topics use a plain domain. be specific and non-duplicative.

return ONLY json: { "topics": [ { "domain": "...", "topic": "...", "key_works": ["author title year"], "priority": 2 } ] }`;

// ── helpers ───────────────────────────────────────────────────────────────────

interface FindingJson {
  title: string;
  summary: string;
  relevance?: string;
  citation?: string;
  tags?: string[];
  chosen?: number[];
}

function audienceOf(domain: string): "mo" | "pam" | "collective" {
  const d = (domain ?? "").toLowerCase().trim();
  if (d.startsWith("mo ·") || d.startsWith("mo·") || d.startsWith("mo:")) return "mo";
  if (d.startsWith("pam ·") || d.startsWith("pam·") || d.startsWith("pam:")) return "pam";
  return "collective";
}

function slugify(s: string): string {
  return (s ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);
}

/** File a real search hit into the bibliography with structured fields. */
async function fileHit(hit: ScholarHit, topicDomain: string) {
  const doiUrl = hit.doi ? `https://doi.org/${hit.doi}` : hit.url ?? null;
  await insertBibliographyRow({
    fullCitation: hit.fullCitation ?? `${hit.authors.join(", ")} (${hit.year ?? "n.d."}). ${hit.title}.`,
    title: hit.title || null,
    year: hit.year ?? null,
    doi: doiUrl,
    sourceType: "cARL finding",
    abstract: hit.abstract ?? undefined,
    publisherLink: doiUrl,
    scholarLink: hit.openAccessPdf ?? null,
    citationCount: hit.citationCount ?? null,
    topic: topicDomain,
    authors: hit.authors?.length ? hit.authors : null,
    firstAuthor: hit.authors?.[0] ?? null,
    journal: hit.venue ?? null,
  });
}

/** Deliver a Mo/Pam-audience finding into that agent's memory. */
async function deliverInsight(
  audience: "mo" | "pam",
  domain: string,
  f: FindingJson,
  citation: string | undefined,
) {
  const today = new Date().toISOString().slice(0, 10);
  const key = `carl-insight-${today}-${slugify(f.title)}`;
  const value =
    `${f.title} — ${f.summary}` +
    (citation ? ` (${citation})` : "") +
    (f.relevance ? ` · why it matters: ${f.relevance}` : "") +
    ` · track: ${domain}`;
  if (audience === "mo") await upsertCmoMemory(key, value, "carl-automation");
  else await upsertPamMemory(key, value, "carl-automation");
}

// ── main ──────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  if (!hasTokenAuth(req) && !(await isLoggedIn())) return error("unauthorized", 401);

  try {
    const count = Math.min(Math.max(Number(param(req, "count")) || TOPICS_PER_RUN, 1), COUNT_CAP);
    const planned = await getCurriculum({ status: "planned" });
    const batch = planned
      .sort((a, b) => a.priority - b.priority || a.sort_order - b.sort_order)
      .slice(0, count);

    let costUsd = 0;
    const studied: { domain: string; topic: string; title: string; audience: string; grounded: boolean; filed: number; delivered: boolean; requested_by: string | null }[] = [];
    const providerTally: Record<string, number> = {};
    const studiedDomains = new Set<string>();

    for (const t of batch) {
      try {
        const audience = audienceOf(t.domain);

        // 1. search the live literature
        const queryStr = `${t.topic} ${(t.key_works ?? []).join(" ")}`.trim();
        const search = await searchScholar(queryStr, { limitPerProvider: 4, timeoutMs: 9000 })
          .catch(() => ({ hits: [] as ScholarHit[], providers: [], errors: [] }));
        for (const p of search.providers) providerTally[p.id] = (providerTally[p.id] ?? 0) + p.count;
        const topHits = search.hits.slice(0, 6);

        let f: FindingJson;
        let chosen: ScholarHit[] = [];
        let grounded = false;

        if (topHits.length > 0) {
          const list = topHits
            .map((h, i) => {
              const cite = h.fullCitation ?? `${h.authors.join(", ")} (${h.year ?? "n.d."}). ${h.title}.`;
              const meta = [h.citationCount != null ? `cited by ${h.citationCount}` : null, h.openAccessPdf ? "OA pdf" : null]
                .filter(Boolean).join(" · ");
              return `[${i}] ${cite}${meta ? ` · ${meta}` : ""}`;
            })
            .join("\n");
          const res = await callClaude({
            feature: "carl-study",
            userId: "carl-automation",
            system: SYSTEM_SEARCH,
            userMessage: `audience: ${audience}\ndomain: ${t.domain}\ntopic: ${t.topic}\n\nreal search results:\n${list}\n\nchoose the most relevant result(s) and write the finding.`,
            maxTokens: 700,
            temperature: 0.3,
          });
          costUsd += res.costUsd;
          f = parseJsonResponse<FindingJson>(res.text);
          const idxs = Array.isArray(f.chosen) ? f.chosen.filter((i) => Number.isInteger(i) && i >= 0 && i < topHits.length) : [];
          chosen = (idxs.length ? idxs : [0]).map((i) => topHits[i]);
          grounded = true;
        } else {
          const res = await callClaude({
            feature: "carl-study",
            userId: "carl-automation",
            system: SYSTEM_KNOWLEDGE,
            userMessage: `audience: ${audience}\ndomain: ${t.domain}\ntopic: ${t.topic}\nkey works: ${(t.key_works ?? []).join("; ") || "(use your knowledge of the canonical literature)"}`,
            maxTokens: 700,
            temperature: 0.3,
          });
          costUsd += res.costUsd;
          f = parseJsonResponse<FindingJson>(res.text);
        }

        // 2. file the finding in cARL's library
        const findingCitation = chosen[0]?.fullCitation ?? f.citation;
        await insertCarlFinding({
          domain: t.domain,
          title: f.title,
          summary: f.summary,
          relevance: f.relevance,
          citation: findingCitation,
          tags: Array.isArray(f.tags) ? f.tags : [],
          source: grounded ? "cARL daily study (search-grounded)" : "cARL daily study",
        });

        // 3. file the source(s) into the bibliography
        let filed = 0;
        if (chosen.length > 0) {
          for (const h of chosen) await fileHit(h, t.domain).then(() => { filed++; }).catch(() => {});
        } else if (f.citation) {
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

        // 4. deliver to Mo/Pam when the topic is for them
        let delivered = false;
        if (audience === "mo" || audience === "pam") {
          await deliverInsight(audience, t.domain, f, findingCitation).then(() => { delivered = true; }).catch(() => {});
        }

        await updateCurriculumTopic(t.id, { status: "covered" });
        studiedDomains.add(t.domain);
        studied.push({ domain: t.domain, topic: t.topic, title: f.title, audience, grounded, filed, delivered, requested_by: t.requested_by ?? null });
      } catch (perTopic) {
        console.error(`[cron/carl-study] topic failed (${t.domain} · ${t.topic}):`, perTopic);
      }
    }

    // 5. provider-efficacy note (learning about sources)
    if (Object.keys(providerTally).length > 0) {
      const tally = Object.entries(providerTally).sort((a, b) => b[1] - a[1]).map(([id, n]) => `${id}: ${n}`).join(" · ");
      await upsertCarlMemory(
        "retrieval-source-notes",
        `last study run (${studied.length} topics across ${[...studiedDomains].join(", ") || "—"}): provider hit-counts — ${tally}. low/zero counts for a domain suggest a source gap worth flagging under 'source-suggestions'.`,
        "carl-automation",
      ).catch(() => {});
    }

    // 6. self-replenish — keep the daily engine fed
    let replenished = 0;
    const remaining = planned.length - studied.length;
    if (remaining < REPLENISH_BELOW) {
      try {
        const need = Math.max(TOPICS_PER_RUN, REPLENISH_BELOW) + 2;
        const res = await callClaude({
          feature: "carl-study",
          userId: "carl-automation",
          system: SYSTEM_REPLENISH,
          userMessage: `propose around ${need} new topics. avoid these recently-studied ones: ${[...studiedDomains].slice(0, 20).join("; ") || "(none)"}.`,
          maxTokens: 900,
          temperature: 0.6,
        });
        costUsd += res.costUsd;
        const out = parseJsonResponse<{ topics?: { domain: string; topic: string; key_works?: string[]; priority?: number }[] }>(res.text);
        for (const nt of out.topics ?? []) {
          if (!nt?.domain || !nt?.topic) continue;
          await insertCarlCurriculumTopic({
            domain: String(nt.domain).trim(),
            topic: String(nt.topic).trim(),
            key_works: Array.isArray(nt.key_works) ? nt.key_works : [],
            priority: typeof nt.priority === "number" ? nt.priority : 2,
            notes: "auto-proposed by cARL to sustain daily study",
          }).then(() => { replenished++; }).catch(() => {});
        }
      } catch (rep) {
        console.error("[cron/carl-study] replenish failed:", rep);
      }
    }

    // 7. notify #canon when requested research topics were completed
    const requestedCompleted = studied.filter((s) => s.requested_by);
    if (requestedCompleted.length > 0) {
      try {
        const grouped = requestedCompleted.reduce<Record<string, typeof requestedCompleted>>((acc, s) => {
          const key = s.requested_by!;
          (acc[key] ??= []).push(s);
          return acc;
        }, {});
        const digest = Object.entries(grouped)
          .map(([who, items]) => {
            const list = items.map((s) => `• *${s.title}* — ${s.domain}`).join("\n");
            return `*${who}* requested:\n${list}`;
          })
          .join("\n\n");
        await postToChannel(
          "#canon",
          `cARL completed ${requestedCompleted.length} requested research topic${requestedCompleted.length === 1 ? "" : "s"}:\n\n${digest}\n\nFindings are in the cARL library.`,
        ).catch(() => {});
      } catch {
        // non-fatal — don't abort the run summary
      }
    }

    return json({
      studied: studied.length,
      grounded: studied.filter((s) => s.grounded).length,
      sources_filed: studied.reduce((n, s) => n + s.filed, 0),
      delivered_to_agents: studied.filter((s) => s.delivered).length,
      replenished,
      remaining_planned: remaining + replenished,
      provider_hits: providerTally,
      cost_usd: Number(costUsd.toFixed(4)),
      findings: studied,
    });
  } catch (err) {
    console.error("[cron/carl-study] run failed:", err);
    return error("carl-study run failed", 500);
  }
}
