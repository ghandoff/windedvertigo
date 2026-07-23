/**
 * Avatar / colour identity for the collective — people and agents.
 *
 * Used by the PaM whirlpool + pulse to give each member a consistent coloured
 * avatar. Light fill + same-family dark text so the chip reads on any surface
 * in both light and dark mode. On-brand vibrant palette (white surfaces +
 * secondary colours; champagne is font-colour only, never a background).
 */

export interface MemberStyle {
  /** 1–2 char monogram for the avatar circle. */
  initial: string;
  /** light fill colour (avatar background). */
  bg: string;
  /** same-family dark colour (avatar text + accents). */
  fg: string;
  /** true for the AI agents, so callers can mark them distinctly. */
  agent: boolean;
}

const PEOPLE: Record<string, MemberStyle> = {
  garrett: { initial: "G", bg: "#E6F1FB", fg: "#0C447C", agent: false },
  maria:   { initial: "M", bg: "#FAECE7", fg: "#993C1D", agent: false },
  payton:  { initial: "P", bg: "#FBEAF0", fg: "#993556", agent: false },
  jamie:   { initial: "J", bg: "#E1F5EE", fg: "#0F6E56", agent: false },
  lamis:   { initial: "L", bg: "#FAEEDA", fg: "#854F0B", agent: false },
};

const AGENTS: Record<string, MemberStyle> = {
  pam:  { initial: "Pa", bg: "#EEEDFE", fg: "#3C3489", agent: true },
  carl: { initial: "C",  bg: "#E1F5EE", fg: "#0F6E56", agent: true },
  biz:  { initial: "B",  bg: "#E6F1FB", fg: "#0C447C", agent: true },
  mo:   { initial: "Mo", bg: "#FBEAF0", fg: "#993556", agent: true },
  opsy: { initial: "O",  bg: "#FAEEDA", fg: "#854F0B", agent: true },
  finn: { initial: "F",  bg: "#EAF3DE", fg: "#27500A", agent: true },
};

const REGISTRY: Record<string, MemberStyle> = { ...PEOPLE, ...AGENTS };

// Deterministic fallback palette for anyone not in the registry (e.g. an
// owner_email local part we don't recognise). Keyed by a cheap name hash so the
// same name always lands on the same colour.
const FALLBACK: Array<Pick<MemberStyle, "bg" | "fg">> = [
  { bg: "#F1EFE8", fg: "#444441" },
  { bg: "#EEEDFE", fg: "#3C3489" },
  { bg: "#FAECE7", fg: "#993C1D" },
  { bg: "#E1F5EE", fg: "#085041" },
  { bg: "#FBEAF0", fg: "#72243E" },
];

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/** Resolve a `who` value (first name, slug, or email) to its avatar style. */
export function memberStyle(who: string | null | undefined): MemberStyle {
  const key = (who ?? "").trim().toLowerCase().split(/[@\s]/)[0];
  if (REGISTRY[key]) return REGISTRY[key];
  const f = FALLBACK[hash(key || "?") % FALLBACK.length];
  return { initial: (key[0] ?? "?").toUpperCase(), bg: f.bg, fg: f.fg, agent: false };
}
