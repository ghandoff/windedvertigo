// Produces a downloadable rubric from a draft. Two formats:
//   - markdown: for sharing with the team / pasting into a doc
//   - print HTML: triggers window.print() with a stylesheet that hides
//     navigation and lays out the rubric as a one-page table

import type { Draft } from "./types";
import { SCALE_LEVELS } from "./types";

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
  if (d.pledge.text) {
    lines.push(`## quality pledge`);
    lines.push(d.pledge.text);
    lines.push("");
  }
  lines.push(`---`);
  lines.push(
    `_drafted with the rubric co-builder companion — windedvertigo.com/harbour/rubric-co-builder-companion_`,
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
