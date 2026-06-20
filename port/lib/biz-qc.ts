/**
 * Biz QC inputs — assembles everything the QC gate needs for one opportunity so
 * the Cowork agent can run the six gates (materials completeness, CV quality,
 * consistency/conflict, submission logistics, quality, go/no-go) and regenerate
 * a v2 locally. Read-only; reuses the existing rfp_* + collective_cv layers.
 */

import { getRfpOpportunityByIdFromSupabase } from "./supabase/rfp-opportunities";
import { getRequirementsByRfp, isRfpReadyForGeneration, type RequirementKind } from "./supabase/rfp-requirements";
import { getAllCvs } from "./supabase/cv";

export interface QcMaterial {
  label: string;
  present: boolean | null; // null = can't auto-detect, needs manual confirm
  url: string | null;
  basis: "baseline" | "submission-requirement";
  note?: string;
}

export interface QcInputs {
  rfp_id: string;
  opportunity: {
    name: string;
    status: string;
    type: string;
    fit: string;
    estimated_value: number | null;
    due_date: string | null;
    deadline_timezone: string | null;
    organization_ids: string[];
    opportunity_url: string | null;
    rfp_document_url: string | null;
    tor_snapshot: string | null;
    decision_notes: string | null;
  };
  materials_checklist: QcMaterial[];
  requirements: {
    total: number;
    by_kind: Record<string, number>;
    unapproved_required_deliverables: number;
    items: Array<{ kind: RequirementKind; label: string; required: boolean; approved: boolean; weight_pct: number | null; page_limit: number | null; word_limit: number | null; source_quote: string | null }>;
  };
  readiness: { ready: boolean; reason: string | null };
  cvs: Array<{ name: string; email: string; current: boolean; last_verified_at: string | null }>;
}

const EOI_TYPES = new Set(["EOI", "Grant"]);

export async function getQcInputs(rfpId: string): Promise<QcInputs | null> {
  const opp = await getRfpOpportunityByIdFromSupabase(rfpId);
  if (!opp) return null;

  const [requirements, readiness, cvs] = await Promise.all([
    getRequirementsByRfp(rfpId).catch(() => []),
    isRfpReadyForGeneration(rfpId).catch(() => ({ ready: false, reason: "readiness check failed", unapprovedCount: 0 })),
    getAllCvs().catch(() => []),
  ]);

  // ── materials checklist — the w.v baseline set + funder-specific submission reqs
  const materials: QcMaterial[] = [
    { label: "cover letter", present: !!opp.coverLetterUrl, url: opp.coverLetterUrl, basis: "baseline" },
    { label: "technical proposal", present: !!opp.proposalDraftUrl, url: opp.proposalDraftUrl, basis: "baseline" },
    { label: "financial proposal", present: !!opp.financialProposalUrl, url: opp.financialProposalUrl, basis: "baseline" },
    { label: "team CVs", present: !!opp.teamCvsUrl, url: opp.teamCvsUrl, basis: "baseline" },
  ];
  if (EOI_TYPES.has(opp.opportunityType)) {
    materials.push({ label: "expression of interest", present: !!opp.expressionOfInterestUrl, url: opp.expressionOfInterestUrl, basis: "baseline" });
  }
  if (opp.questionBankUrl || (opp.questionCount ?? 0) > 0) {
    materials.push({ label: "question / clarification responses", present: !!opp.questionBankUrl, url: opp.questionBankUrl, basis: "baseline" });
  }
  // funder-specific submission + admin requirements (forms, registrations) — can't
  // auto-detect a corresponding artefact, so flag for manual confirmation.
  for (const r of requirements.filter((x) => x.kind === "submission" || x.kind === "admin")) {
    materials.push({ label: r.label, present: null, url: null, basis: "submission-requirement", note: r.description ?? undefined });
  }

  // ── requirements summary
  const by_kind: Record<string, number> = {};
  for (const r of requirements) by_kind[r.kind] = (by_kind[r.kind] ?? 0) + 1;
  const unapproved = requirements.filter((r) => r.kind === "deliverable" && r.required && !r.approvedAt).length;

  // ── CV currency (computed inline from lastVerifiedAt + expiresAfterDays)
  const now = Date.now();
  const cvRoster = cvs.map((c) => {
    const current = !!c.lastVerifiedAt && (now - new Date(c.lastVerifiedAt).getTime()) < c.expiresAfterDays * 86_400_000;
    return { name: c.memberName, email: c.memberEmail, current, last_verified_at: c.lastVerifiedAt };
  });

  return {
    rfp_id: rfpId,
    opportunity: {
      name: opp.opportunityName,
      status: opp.status,
      type: opp.opportunityType,
      fit: opp.wvFitScore,
      estimated_value: opp.estimatedValue,
      due_date: opp.dueDate?.start ?? null,
      deadline_timezone: opp.deadlineTimezone,
      organization_ids: opp.organizationIds,
      opportunity_url: opp.url || null,
      rfp_document_url: opp.rfpDocumentUrl,
      tor_snapshot: opp.requirementsSnapshot || null,
      decision_notes: opp.decisionNotes || null,
    },
    materials_checklist: materials,
    requirements: {
      total: requirements.length,
      by_kind,
      unapproved_required_deliverables: unapproved,
      items: requirements.map((r) => ({
        kind: r.kind,
        label: r.label,
        required: r.required,
        approved: !!r.approvedAt,
        weight_pct: r.weightPct,
        page_limit: r.pageLimit,
        word_limit: r.wordLimit,
        source_quote: r.sourceQuote,
      })),
    },
    readiness: { ready: readiness.ready, reason: readiness.reason },
    cvs: cvRoster,
  };
}
