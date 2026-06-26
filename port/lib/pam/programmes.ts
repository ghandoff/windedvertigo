/**
 * Stable colour identity for a programme (a `pam_commitments.programme` value,
 * which matches a `projects.project` name). The same programme always gets the
 * same colour, so a deliverable's timeline bar and a commitment's badge read as
 * the same thing across the whole PaM surface.
 *
 * Amber is deliberately NOT in this palette — it's reserved for the timeline's
 * RFP / business-development lane so that lane stays visually distinct.
 */

export interface ProgrammeStyle {
  bg: string;   // light badge fill
  fg: string;   // same-family dark text
  fill: string; // light bar fill (timeline)
  mark: string; // darker — diamonds, dot, accent
}

const PALETTE: ProgrammeStyle[] = [
  { bg: "#E6F1FB", fg: "#0C447C", fill: "#85B7EB", mark: "#185FA5" }, // blue
  { bg: "#E1F5EE", fg: "#0F6E56", fill: "#5DCAA5", mark: "#0F6E56" }, // teal
  { bg: "#EEEDFE", fg: "#3C3489", fill: "#AFA9EC", mark: "#534AB7" }, // violet
  { bg: "#FAECE7", fg: "#993C1D", fill: "#F0997B", mark: "#D85A30" }, // coral
  { bg: "#FBEAF0", fg: "#993556", fill: "#ED93B1", mark: "#D4537E" }, // pink
  { bg: "#EAF3DE", fg: "#27500A", fill: "#C0DD97", mark: "#639922" }, // green
];

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function programmeStyle(name: string): ProgrammeStyle {
  return PALETTE[hash(name.trim().toLowerCase()) % PALETTE.length];
}
