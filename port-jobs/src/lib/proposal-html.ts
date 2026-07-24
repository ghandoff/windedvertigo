/**
 * Render a generated ProposalDraft to a self-contained HTML document.
 *
 * This is the DURABLE, Notion-independent home for a proposal draft. The
 * consumer stores it to R2 the moment generation succeeds, so a downstream
 * Notion write (createDeal) failing can never discard an already-paid draft.
 */

import type { ProposalDraft, TraceabilityScore } from "@/lib/ai/proposal-generator";

function esc(s: string): string {
  return (s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Minimal markdown → HTML: **bold**, blank-line paragraphs, single-line breaks. */
function mdToHtml(s: string): string {
  const bolded = esc(s).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  return bolded
    .split(/\n{2,}/)
    .map((p) => `<p>${p.trim().replace(/\n/g, "<br>")}</p>`)
    .join("\n");
}

export interface ProposalHtmlContext {
  rfpName: string;
  orgName?: string | null;
  dueLabel?: string | null;
  valueLabel?: string | null;
  traceability?: TraceabilityScore | null;
}

export function renderProposalHtml(draft: ProposalDraft, ctx: ProposalHtmlContext): string {
  const section = (title: string, body: string) =>
    body && body.trim() ? `<h2>${esc(title)}</h2>${mdToHtml(body)}` : "";
  const list = (title: string, items: string[]) =>
    items && items.length
      ? `<h2>${esc(title)}</h2><ul>${items.map((i) => `<li>${esc(i)}</li>`).join("")}</ul>`
      : "";
  const experience =
    draft.relevantExperience && draft.relevantExperience.length
      ? `<h2>Relevant Experience</h2>` +
        draft.relevantExperience.map((e) => `<h3>${esc(e.project)}</h3>${mdToHtml(e.relevance)}`).join("")
      : "";

  const metaBits = [
    ctx.orgName && `Client: ${esc(ctx.orgName)}`,
    ctx.dueLabel && `Due: ${esc(ctx.dueLabel)}`,
    ctx.valueLabel && `Value: ${esc(ctx.valueLabel)}`,
  ].filter(Boolean);

  const body = [
    metaBits.length ? `<p class="meta">${metaBits.join("  ·  ")}</p>` : "",
    draft.requiresCoverLetter && draft.coverLetter ? section("Cover Letter", draft.coverLetter) : "",
    section("Executive Summary", draft.executiveSummary),
    section("Understanding of Requirements", draft.understandingOfRequirements),
    section("Proposed Approach", draft.proposedApproach),
    experience,
    section("Team Composition", draft.teamComposition),
    section("Value Proposition", draft.valueProposition),
    section("Budget Framework", draft.budgetFramework),
    section("Risk Mitigation", draft.riskMitigation),
    list("Clarifying Questions for Client", draft.clarifyingQuestions),
    list("Gaps to Fill Before Submitting", draft.missingInfo),
    list("References", draft.references),
    ctx.traceability
      ? `<p class="trace">Citation traceability: ${
          ctx.traceability.score !== null ? `${ctx.traceability.score}/100` : "n/a"
        } — ${esc(ctx.traceability.breakdown.join("; "))}</p>`
      : "",
  ]
    .filter(Boolean)
    .join("\n");

  return (
    `<!doctype html><html lang="en"><head><meta charset="utf-8">` +
    `<meta name="viewport" content="width=device-width,initial-scale=1">` +
    `<title>${esc(ctx.rfpName)} — proposal draft</title>` +
    `<style>body{max-width:820px;margin:2rem auto;padding:0 1.25rem;` +
    `font:16px/1.6 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;color:#1a1a1a}` +
    `h1{font-size:1.7rem;margin-bottom:.25rem}h2{margin-top:2rem;border-bottom:1px solid #eee;padding-bottom:.25rem}` +
    `h3{margin-top:1.25rem;color:#444}.meta{color:#666}ul{padding-left:1.25rem}` +
    `.trace{color:#999;font-size:.85rem;margin-top:2.5rem;border-top:1px solid #eee;padding-top:1rem}</style>` +
    `</head><body><h1>${esc(ctx.rfpName)}</h1>${body}</body></html>`
  );
}
