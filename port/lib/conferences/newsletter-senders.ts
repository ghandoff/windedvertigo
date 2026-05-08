/**
 * Curated newsletter sender registry for the conference discovery pipeline.
 *
 * The daily `scan-conference-newsletters` cron uses this list as a STRICT
 * allowlist — only mail from these domains is queried. Personal mail is
 * never touched. Adding a new sender here is the only way to expand scan
 * coverage; the cron route never accepts free-form sender params.
 *
 * Signal strength is a hint about how reliable this sender is for surfacing
 * actual conferences (vs. course promos, member-news). The AI triage layer
 * still gates the final candidate decision — signalStrength is not used to
 * skip triage today, but kept for future weighting / per-sender thresholds.
 */

export interface NewsletterSender {
  domain: string;
  label: string;
  /** higher = more reliable signal; AI triage still gates final decision */
  signalStrength: "high" | "medium" | "low";
  /** optional sender-specific subject pattern hint */
  subjectHint?: RegExp;
}

const CONFERENCE_SUBJECT_HINT =
  /(?:call for|abstract|cfp|conference|summit|symposium|early bird|registration|deadline)/i;

export const NEWSLETTER_SENDERS: NewsletterSender[] = [
  // ── high-signal academic + professional associations ─────────
  {
    domain: "aera.net",
    label: "AERA — American Educational Research Association",
    signalStrength: "high",
  },
  {
    domain: "aect.org",
    label: "AECT — Association for Educational Communications & Technology",
    signalStrength: "high",
  },
  {
    domain: "earli.org",
    label: "EARLI — European Association for Research on Learning and Instruction",
    signalStrength: "high",
  },
  {
    domain: "ecer.eu",
    label: "ECER — European Conference on Educational Research",
    signalStrength: "high",
  },
  {
    domain: "atd.org",
    label: "ATD — Association for Talent Development",
    signalStrength: "high",
  },
  {
    domain: "learninganalytics.solar",
    label: "SoLAR — Society for Learning Analytics Research",
    signalStrength: "high",
  },
  {
    domain: "iclsoc.org",
    label: "ISLS — International Society of the Learning Sciences",
    signalStrength: "high",
  },

  // ── medium-signal trade press + speaker platforms ────────────
  {
    domain: "elearningindustry.com",
    label: "eLearning Industry",
    signalStrength: "medium",
    subjectHint: CONFERENCE_SUBJECT_HINT,
  },
  {
    domain: "conferencealerts.com",
    label: "Conference Alerts",
    signalStrength: "medium",
    subjectHint: CONFERENCE_SUBJECT_HINT,
  },
  {
    domain: "sessionize.com",
    label: "Sessionize — speaker / CFP platform",
    signalStrength: "medium",
    subjectHint: CONFERENCE_SUBJECT_HINT,
  },
  {
    domain: "papercall.io",
    label: "PaperCall — CFP platform",
    signalStrength: "medium",
    subjectHint: CONFERENCE_SUBJECT_HINT,
  },
  {
    domain: "aoir.org",
    label: "AoIR — Association of Internet Researchers",
    signalStrength: "medium",
    subjectHint: CONFERENCE_SUBJECT_HINT,
  },
  {
    domain: "iste.org",
    label: "ISTE — International Society for Technology in Education",
    signalStrength: "medium",
    subjectHint: CONFERENCE_SUBJECT_HINT,
  },
  {
    domain: "learningforward.org",
    label: "Learning Forward",
    signalStrength: "medium",
    subjectHint: CONFERENCE_SUBJECT_HINT,
  },

  // ── low-signal / experimental ───────────────────────────────
  {
    domain: "aiir.global",
    label: "AIIR — AI in Education",
    signalStrength: "low",
    subjectHint: CONFERENCE_SUBJECT_HINT,
  },
];

/**
 * Build a Gmail search query that matches mail from any of the allowlisted
 * sender domains, received in the last `sinceDays` days.
 *
 * Output shape:
 *   `(from:aera.net OR from:aect.org OR ...) newer_than:1d`
 *
 * Gmail's `from:` operator on a bare domain matches any address `*@domain`,
 * which is what we want. The `newer_than:` operator is documented and stable.
 */
export function buildGmailQuery(
  senders: NewsletterSender[],
  sinceDays = 1,
): string {
  if (senders.length === 0) return "";
  const fromClause = senders.map((s) => `from:${s.domain}`).join(" OR ");
  return `(${fromClause}) newer_than:${Math.max(1, Math.floor(sinceDays))}d`;
}
