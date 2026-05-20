// Produces a downloadable rubric from a draft. Two formats:
//   - markdown: for sharing with the team / pasting into a doc
//   - print HTML: triggers window.print() with a stylesheet that hides
//     navigation and lays out the rubric as a one-page table

import type { Draft } from "./types";
import { AI_USE_LEVELS, SCALE_LEVELS } from "./types";

export function draftToMarkdown(d: Draft): string {
  const lines: string[] = [];
  lines.push(`# rubric`);
  lines.push("");
  if (d.learning_outcome) {
    lines.push(`**learning outcome:** ${d.learning_outcome}`);
  }
  if (d.artefact) {
    lines.push(`**artefact:** ${d.artefact}`);
  }
  lines.push("");
  for (const c of d.criteria) {
    lines.push(`## ${c.name}${c.required ? " (required)" : ""}`);
    if (c.good_description) {
      lines.push(`*what good looks like:* ${c.good_description}`);
      lines.push("");
    }
    for (const level of SCALE_LEVELS) {
      const desc = d.descriptors.find(
        (x) => x.criterion_id === c.id && x.level === level.level,
      );
      lines.push(`- **${level.level} · ${level.label}** — ${desc?.text ?? "—"}`);
    }
    lines.push("");
  }
  // AI use pledge — 5 fields total: the chosen ladder rung + 4 prompts.
  // We render any field the user actually filled; skip the heading entirely
  // if they touched none of them, so blank exports stay tidy.
  const p = d.pledge;
  const aiRung =
    p.ai_level !== null ? AI_USE_LEVELS.find((r) => r.level === p.ai_level) : null;
  const hasAnyPledge =
    aiRung ||
    p.will_use_for.trim() ||
    p.will_not_use_for.trim() ||
    p.will_disclose.trim() ||
    p.if_cross_line.trim();
  if (hasAnyPledge) {
    lines.push(`## AI use pledge`);
    if (aiRung) {
      lines.push(`**rung ${aiRung.level}:** ${aiRung.name} ${aiRung.helper}`);
      lines.push("");
    }
    if (p.will_use_for.trim()) {
      lines.push(`**we will use AI for:** ${p.will_use_for.trim()}`);
    }
    if (p.will_not_use_for.trim()) {
      lines.push(`**we will NOT use AI for:** ${p.will_not_use_for.trim()}`);
    }
    if (p.will_disclose.trim()) {
      lines.push(`**we will disclose:** ${p.will_disclose.trim()}`);
    }
    if (p.if_cross_line.trim()) {
      lines.push(`**if we cross our own line, we will:** ${p.if_cross_line.trim()}`);
    }
    lines.push("");
  }
  lines.push(`---`);
  lines.push(
    `_drafted with the co.rubric companion — windedvertigo.com/harbour/co-rubric-companion_`,
  );
  return lines.join("\n");
}

export function downloadMarkdown(d: Draft, filename = "rubric.md"): void {
  if (typeof window === "undefined") return;
  const md = draftToMarkdown(d);
  const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
