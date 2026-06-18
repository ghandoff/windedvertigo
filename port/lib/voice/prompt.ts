/**
 * Voice system-prompt assembly.
 *
 * Combines an assistant's intro + posture + live briefing into a single
 * spoken-delivery system prompt. The static prefix (intro + posture +
 * spoken-delivery rules) is stable across a call, so we mark it for Anthropic
 * prompt caching; the live briefing is appended after.
 *
 * Briefings are fetched from the same-origin port memory API (the existing
 * /api/{agent}/briefing routes, Bearer CMO_API_TOKEN). To avoid a network
 * round-trip on every turn of a call, briefings are cached in-process per slug
 * for a short TTL — state rarely changes mid-call. Fail-open: a missing
 * briefing degrades to a note, it never breaks the call.
 */

import type { VoiceAssistant } from "./assistants";

// ---------------------------------------------------------------------------
// Briefing fetch (TTL-cached, fail-open)
// ---------------------------------------------------------------------------

const BRIEFING_TTL_MS = 60_000;
const briefingCache = new Map<string, { text: string; at: number }>();

function briefingBaseUrl(): string {
  return (
    process.env.VOICE_BRIEFING_BASE_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    "https://port.windedvertigo.com"
  );
}

/** Render Fin's structured /briefing JSON into spoken-friendly markdown. */
function renderFinBriefing(data: Record<string, unknown>): string {
  const usd = (cents: unknown): string | null =>
    typeof cents === "number"
      ? `$${Math.round(cents / 100).toLocaleString("en-US")}`
      : null;

  const lines: string[] = ["# Fin briefing"];

  const memory = Array.isArray(data.memory) ? data.memory : [];
  if (memory.length) {
    lines.push("\n## working state");
    for (const m of memory as Array<Record<string, unknown>>) {
      lines.push(`- ${m.key}: ${m.value}`);
    }
  }

  const snapshots = (data.snapshots ?? {}) as Record<string, Record<string, unknown> | null>;
  const snapEntries = Object.entries(snapshots).filter(([, s]) => s);
  if (snapEntries.length) {
    lines.push("\n## latest financial snapshots");
    for (const [type, s] of snapEntries) {
      const label = s?.period_label ? ` (${s.period_label})` : "";
      const body = s?.data ? JSON.stringify(s.data) : "";
      lines.push(`- ${type}${label}: ${body.slice(0, 600)}`);
    }
  }

  const open = Array.isArray(data.open_items) ? (data.open_items as Array<Record<string, unknown>>) : [];
  if (open.length) {
    lines.push(`\n## open items (${open.length})`);
    for (const i of open.slice(0, 25)) {
      const amt = usd(i.amount_cents);
      const due = i.due_date ? ` due ${i.due_date}` : "";
      lines.push(`- [${i.type}] ${i.title}${amt ? ` — ${amt}` : ""}${due}`);
    }
  }

  const deadlines = Array.isArray(data.upcoming_deadlines)
    ? (data.upcoming_deadlines as Array<Record<string, unknown>>)
    : [];
  if (deadlines.length) {
    lines.push(`\n## upcoming deadlines (next 30 days)`);
    for (const d of deadlines.slice(0, 25)) {
      const amt = usd(d.amount_cents);
      lines.push(`- ${d.due_date}: ${d.title}${amt ? ` — ${amt}` : ""}`);
    }
  }

  const decisions = Array.isArray(data.recent_decisions)
    ? (data.recent_decisions as Array<Record<string, unknown>>)
    : [];
  if (decisions.length) {
    lines.push("\n## recent decisions");
    for (const d of decisions.slice(0, 10)) {
      lines.push(`- ${d.decision}${d.context ? ` (${d.context})` : ""}`);
    }
  }

  if (lines.length === 1) return "(no financial data recorded yet.)";
  return lines.join("\n");
}

/** Fetch an agent's briefing markdown. Returns "" for the memory-less Claude line. */
export async function fetchVoiceBriefing(a: VoiceAssistant): Promise<string> {
  if (!a.briefingPath) return "";

  const now = Date.now();
  const cached = briefingCache.get(a.slug);
  if (cached && now - cached.at < BRIEFING_TTL_MS) return cached.text;

  const token = process.env.CMO_API_TOKEN ?? "";
  try {
    const res = await fetch(
      `${briefingBaseUrl()}/api/${a.briefingPath}/briefing`,
      { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" },
    );
    if (!res.ok) {
      console.warn(`[voice] briefing ${res.status} for ${a.slug}`);
      const fallback = "(live briefing unavailable right now.)";
      briefingCache.set(a.slug, { text: fallback, at: now });
      return fallback;
    }
    const data = (await res.json()) as Record<string, unknown>;
    // Most agents return a ready `briefing` markdown string. Fin's route
    // returns structured JSON instead, so render it to spoken-friendly text.
    const text =
      typeof data.briefing === "string"
        ? data.briefing
        : a.slug === "fin"
          ? renderFinBriefing(data)
          : "(live briefing empty.)";
    briefingCache.set(a.slug, { text, at: now });
    return text;
  } catch (err) {
    console.warn(
      "[voice] briefing fetch failed:",
      err instanceof Error ? err.message : err,
    );
    return "(live briefing unavailable — network error.)";
  }
}

// ---------------------------------------------------------------------------
// System prompt
// ---------------------------------------------------------------------------

const SPOKEN_DELIVERY = `## you are on a phone call

this is a live voice call — your words are spoken aloud, not read. so:
- talk like a person, not a document. short sentences. no markdown, no bullet points, no headings, no emoji.
- lead with the answer, then a little detail. keep most replies to a few sentences — this is a conversation, not a briefing.
- spell things out for the ear: say "three thousand dollars", not "$3,000"; "the rfp", not "RFP" unless it's natural.
- it's fine to be warm and brief. ask one question at a time. if you need a moment, say so.
- you're speaking with Garrett. you don't need to introduce yourself again mid-call.`;

/**
 * Static prefix of the system prompt (intro + posture + spoken rules).
 * Stable across a call → cache this with Anthropic prompt caching.
 */
export function buildStaticSystemPrefix(a: VoiceAssistant): string {
  const parts = [a.intro];
  if (a.posture) parts.push(`## your posture\n\n${a.posture}`);
  parts.push(SPOKEN_DELIVERY);
  return parts.join("\n\n");
}

/** The dynamic suffix: live briefing for this call. Empty for the Claude line. */
export function buildBriefingSuffix(briefing: string): string {
  if (!briefing) return "";
  return `## current state (loaded at the start of this call)\n\n${briefing}`;
}
