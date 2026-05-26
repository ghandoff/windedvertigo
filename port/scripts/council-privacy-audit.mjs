#!/usr/bin/env node
/**
 * Council privacy audit — flags potentially-personal meetings that are
 * currently marked `visibility='shared'` so a human can review + reclassify.
 *
 * The risk: gcal-sync pre-creates every meeting as 'shared' by default, so
 * therapy / doctor / family / 1-on-1-with-external meetings can sit on
 * /council visible to the whole team until someone notices.
 *
 * Heuristics (any single signal triggers a flag; multiple = higher priority):
 *  - title keyword match (therapy, leah, randall, doctor, dentist, lawyer,
 *    personal, family, dr., MD, etc.)
 *  - only one w.v attendee (you alone or you + one external)
 *  - all external attendees with you (no other w.v people present)
 *  - very short title that's just a person's first name
 *
 * Output: a sorted list. For each suggestion you can either:
 *   - run with `--apply` to flip all flagged-as-likely-private meetings to private
 *   - copy individual UPDATEs from the suggested-sql column
 *
 * Usage:
 *   node scripts/council-privacy-audit.mjs                  # dry-run report
 *   node scripts/council-privacy-audit.mjs --apply HIGH     # flip HIGH-risk to private
 *   node scripts/council-privacy-audit.mjs --apply ALL      # flip every flagged row
 */

import process from "node:process";

const {
  NEXT_PUBLIC_SUPABASE_URL: SB_URL,
  SUPABASE_SECRET_KEY: SB_KEY,
} = process.env;

if (!SB_URL || !SB_KEY) {
  console.error("missing env: NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SECRET_KEY");
  process.exit(1);
}

const APPLY = process.argv.includes("--apply");
const APPLY_LEVEL = APPLY
  ? (process.argv[process.argv.indexOf("--apply") + 1] || "").toUpperCase()
  : null;
const WV_DOMAIN = "windedvertigo.com";

// Title keywords that strongly suggest personal content (private by default).
// Lowercase, matched as substrings. Add any others as you spot patterns.
const PRIVATE_KEYWORDS = [
  "therapy",
  "leah",            // your therapist
  "randall",         // hold-name for therapy (per today's session)
  "doctor",
  "dr.",
  "dentist",
  "ortho",
  "lawyer",
  "attorney",
  "personal",
  "family",
  "gina",            // your wife — anything she's on is presumed personal
  "couples",
  "kids",
  "daughter",
  "son",
  "school",          // your kids' school
  "pediatric",
  "vet",
];

async function sbGet(path) {
  const r = await fetch(`${SB_URL}/rest/v1/${path}`, {
    headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` },
  });
  if (!r.ok) throw new Error(`SB GET ${path}: ${r.status} ${await r.text()}`);
  return r.json();
}

async function sbPatch(path, body) {
  const r = await fetch(`${SB_URL}/rest/v1/${path}`, {
    method: "PATCH",
    headers: {
      apikey: SB_KEY,
      Authorization: `Bearer ${SB_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`SB PATCH ${path}: ${r.status} ${await r.text()}`);
}

// ---------------------------------------------------------------------------
// Load + classify every currently-shared meeting
// ---------------------------------------------------------------------------
const meetings = await sbGet(
  "meetings?visibility=eq.shared&select=id,title,started_at,attendee_emails,organizer_email,owner_email&order=started_at.desc",
);

console.error(`scanning ${meetings.length} shared meetings…\n`);

const flagged = [];

for (const m of meetings) {
  const title = (m.title || "").toLowerCase();
  const attendees = m.attendee_emails || [];
  const wvAttendees = attendees.filter((e) => e?.toLowerCase().endsWith(`@${WV_DOMAIN}`));
  const externalAttendees = attendees.filter((e) => !e?.toLowerCase().endsWith(`@${WV_DOMAIN}`));

  const reasons = [];
  let score = 0;

  // Signal 1: title keyword
  const matchedKeyword = PRIVATE_KEYWORDS.find((k) => title.includes(k));
  if (matchedKeyword) {
    reasons.push(`keyword:${matchedKeyword}`);
    score += 3;
  }

  // Signal 2: only one w.v attendee → no team accountability for the meeting
  if (wvAttendees.length === 1) {
    reasons.push(`solo-wv (${wvAttendees[0]})`);
    score += 1;
  }

  // Signal 3: zero w.v attendees other than the organizer (1-on-1 with external)
  if (wvAttendees.length <= 1 && externalAttendees.length === 1) {
    reasons.push("1-on-1-external");
    score += 2;
  }

  // Signal 4: title is just a person's first name (single word, ≤10 chars)
  if (/^[a-z]+$/i.test((m.title || "").trim()) && (m.title || "").trim().length <= 10) {
    reasons.push("name-only-title");
    score += 2;
  }

  // Signal 5: no organizer + no attendees = unclassifiable, low risk but flag for visibility
  if (!m.organizer_email && attendees.length === 0) {
    reasons.push("no-attendees");
    score += 0;  // informational only
  }

  if (reasons.length > 0 && score > 0) {
    const level = score >= 3 ? "HIGH" : score >= 2 ? "MED" : "LOW";
    flagged.push({ ...m, score, level, reasons, wvAttendees, externalAttendees });
  }
}

flagged.sort((a, b) => b.score - a.score);

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------
const byLevel = { HIGH: [], MED: [], LOW: [] };
for (const f of flagged) byLevel[f.level].push(f);

console.error(`flagged: ${flagged.length} (HIGH: ${byLevel.HIGH.length}, MED: ${byLevel.MED.length}, LOW: ${byLevel.LOW.length})\n`);

for (const level of ["HIGH", "MED", "LOW"]) {
  if (byLevel[level].length === 0) continue;
  console.error(`──────────── ${level} ────────────`);
  for (const f of byLevel[level]) {
    const date = f.started_at?.split("T")[0] ?? "no-date";
    console.error(`  ${date}  ${f.title || "<no title>"}`);
    console.error(`    id:       ${f.id}`);
    console.error(`    reasons:  ${f.reasons.join(", ")}`);
    console.error(`    wv:       ${f.wvAttendees.join(", ") || "—"}`);
    console.error(`    external: ${f.externalAttendees.join(", ") || "—"}`);
    console.error(`    review:   https://port.windedvertigo.com/council/${f.id}`);
    console.error();
  }
}

// ---------------------------------------------------------------------------
// Optionally apply: flip the matching tier to private + claim ownership
// ---------------------------------------------------------------------------
if (APPLY) {
  const owner = "garrett@windedvertigo.com";
  const targets = APPLY_LEVEL === "ALL" ? flagged
    : APPLY_LEVEL === "HIGH" ? byLevel.HIGH
    : APPLY_LEVEL === "MED" ? [...byLevel.HIGH, ...byLevel.MED]
    : [];

  if (targets.length === 0) {
    console.error(`--apply ${APPLY_LEVEL} matched zero rows. valid: HIGH | MED | ALL`);
    process.exit(0);
  }

  console.error(`\napplying private+owner=${owner} to ${targets.length} meetings…`);
  for (const t of targets) {
    await sbPatch(`meetings?id=eq.${t.id}`, {
      visibility: "private",
      owner_email: owner,
    });
    console.error(`  ✓ ${t.id} → private`);
  }
  console.error("done.");
} else {
  console.error("\n(dry run — no changes made. re-run with `--apply HIGH` to lock down high-risk rows.)");
}
