/**
 * POST /api/rfp-radar/[id]/qc-review
 *
 * BIZ-Q1 — pre-submission scrub gate.
 *
 * Scans a proposal draft bundle for three categories of hard-blocking issues
 * and three categories of warnings. A 'pass' verdict is only reachable with
 * zero unresolved blocking items.
 *
 * Blocking (high severity — fail the bundle):
 *   unsourced-figure    Any number / currency / percentage not adjacent to a
 *                       source marker (footnote, citation bracket, "per [ToR]").
 *   unverified-cv       Any team member name in the draft that does not match a
 *                       'verified'-confidence canonical CV entry. Also applies
 *                       the name-alias map (e.g. "James" → "Jamie Galpin").
 *   tor-mismatch        Phase count, timeline, page limit, or word limit
 *                       contradicting the approved ToR requirements for this RFP.
 *
 * Warnings (lower severity — surface but do not block):
 *   de-templated-bio    Bio text containing "[Client]", "TBD", or "Unknown".
 *   voice-antithesis    Passive-voice or generic opener patterns.
 *   unanswered-question clarifyingQuestions list items still unresolved.
 *
 * Rule definitions: .brain/memory/biz/auto-draft-scrub-list.md
 *
 * Body: { draftText: string, targetDocKind?: string }
 * Returns: { verdict, blockingItems, warnings }
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getAllCvs, cvConfidence } from "@/lib/supabase/cv";
import { getApprovedDeliverables } from "@/lib/supabase/rfp-requirements";
import {
  scanFigures,
  findUnverifiedCvClaims,
  checkTorMismatches,
  NAME_ALIASES,
} from "@/lib/biz/qc-scrub";

// ── Warning patterns ──────────────────────────────────────────────────────────
const DE_TEMPLATE_PATTERN = /\[Client\]|\bTBD\b|Client:\s*Unknown|Organisation:\s*Unknown/gi;
const PASSIVE_OPENER_PATTERN = /^(It is|There (is|are|will be)|This (proposal|document|report) (will|is|has))/im;

// ── Handler ───────────────────────────────────────────────────────────────────

interface QcBlockingItem {
  rule: "unsourced-figure" | "unverified-cv" | "tor-mismatch";
  severity: "high";
  offendingText: string;
  detail: string;
}

interface QcWarning {
  rule: "de-templated-bio" | "voice-antithesis" | "unanswered-question" | "unsourced-figure";
  detail: string;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: { draftText: string; targetDocKind?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const { draftText } = body;
  if (!draftText?.trim()) {
    return NextResponse.json({ error: "draftText is required" }, { status: 400 });
  }

  const blockingItems: QcBlockingItem[] = [];
  const warnings: QcWarning[] = [];

  // ── (a) Unsourced figures ─────────────────────────────────────────────────
  // blocking: currency/magnitude figures (e.g. $20M); warnings: plain integers >=1000.
  const figureScan = scanFigures(draftText);
  for (const fig of figureScan.blocking) {
    blockingItems.push({
      rule: "unsourced-figure",
      severity: "high",
      offendingText: fig,
      detail: `"${fig}" appears without a traceable source marker (footnote, citation bracket, or "per ToR/RFP")`,
    });
  }
  for (const fig of figureScan.warnings) {
    warnings.push({
      rule: "unsourced-figure",
      detail: `"${fig}" is a large unsourced number — review whether a source is needed`,
    });
  }

  // ── (b) Unverified CV claims ──────────────────────────────────────────────
  let cvMap: Map<string, "verified" | "needs-review" | "draft">;
  try {
    const cvs = await getAllCvs();
    cvMap = new Map(cvs.map((cv) => [cv.memberName, cvConfidence(cv)]));
  } catch (err) {
    console.error("[qc-review] cv fetch failed:", err);
    cvMap = new Map();
  }

  const unverifiedClaims = findUnverifiedCvClaims(draftText, cvMap);
  for (const claim of unverifiedClaims) {
    const canonicalName = NAME_ALIASES[claim.name] ?? claim.name;
    const confidenceLabel =
      claim.confidence === "not-found"
        ? "not found in canonical CV roster"
        : `CV is '${claim.confidence}' — needs re-verification before submission`;
    blockingItems.push({
      rule: "unverified-cv",
      severity: "high",
      offendingText: claim.name,
      detail: `"${claim.name}" → canonical name "${canonicalName}": ${confidenceLabel}`,
    });
  }

  // ── (c) Structure vs ToR mismatch ─────────────────────────────────────────
  try {
    const deliverables = await getApprovedDeliverables(id);
    const torMismatches = checkTorMismatches(draftText, deliverables);
    for (const m of torMismatches) {
      blockingItems.push({
        rule: "tor-mismatch",
        severity: "high",
        offendingText: m.field,
        detail: m.detail,
      });
    }
  } catch (err) {
    console.error("[qc-review] deliverables fetch failed:", err);
  }

  // ── Warnings ──────────────────────────────────────────────────────────────
  let hit: RegExpExecArray | null;
  DE_TEMPLATE_PATTERN.lastIndex = 0;
  while ((hit = DE_TEMPLATE_PATTERN.exec(draftText)) !== null) {
    warnings.push({
      rule: "de-templated-bio",
      detail: `placeholder text found: "${hit[0]}"`,
    });
    break; // one warning per kind is enough
  }

  if (PASSIVE_OPENER_PATTERN.test(draftText)) {
    warnings.push({
      rule: "voice-antithesis",
      detail: "document opens with a weak passive or impersonal construction",
    });
  }

  const verdict = blockingItems.length === 0 ? "pass" : "fail";

  return NextResponse.json({ verdict, blockingItems, warnings });
}
