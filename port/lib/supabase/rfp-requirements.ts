/**
 * Supabase layer for rfp_requirements — the structured spine of an RFP.
 *
 * Each row = one extracted requirement from the TOR (a deliverable like
 * "Expression of Interest, ≤2 pages", an evaluation criterion, an eligibility
 * constraint, an admin requirement, or a submission instruction).
 *
 * The proposal generator reads `kind='deliverable'` rows to know exactly which
 * documents to produce and to what spec; the verification UI reads all rows
 * (grouped by kind) so the user can approve/edit before generation runs.
 *
 * Provenance fields (extracted_by, extraction_confidence, source_quote)
 * support the verification gate: the user can sanity-check each AI-extracted
 * row against the original TOR text in one glance.
 */

import { supabase } from "./client";

// ── Row type (matches Postgres schema in 20260508_rfp_pipeline_v2.sql) ───────

export type RequirementKind =
  | "deliverable"
  | "eligibility"
  | "evaluation_criterion"
  | "admin"
  | "submission";

export interface RfpRequirement {
  id: string;
  rfpId: string;
  kind: RequirementKind;
  label: string;
  description: string | null;
  pageLimit: number | null;
  wordLimit: number | null;
  format: "pdf" | "docx" | "either" | null;
  requiredSections: string[];
  weightPct: number | null;
  required: boolean;
  approvedBy: string | null;
  approvedAt: string | null;
  extractedBy: string | null;
  extractionConfidence: number | null;
  sourceQuote: string | null;
  createdAt: string;
  updatedAt: string;
}

interface RfpRequirementRow {
  id: string;
  rfp_id: string;
  kind: string;
  label: string;
  description: string | null;
  page_limit: number | null;
  word_limit: number | null;
  format: string | null;
  required_sections: string[] | null;
  weight_pct: string | number | null;  // Postgres NUMERIC may serialize as string
  required: boolean;
  approved_by: string | null;
  approved_at: string | null;
  extracted_by: string | null;
  extraction_confidence: string | number | null;
  source_quote: string | null;
  created_at: string;
  updated_at: string;
}

const SELECT_COLS =
  "id, rfp_id, kind, label, description, page_limit, word_limit, format, " +
  "required_sections, weight_pct, required, approved_by, approved_at, " +
  "extracted_by, extraction_confidence, source_quote, created_at, updated_at";

function toNum(v: string | number | null): number | null {
  if (v === null || v === undefined) return null;
  return typeof v === "number" ? v : Number(v);
}

function rowToRequirement(row: RfpRequirementRow): RfpRequirement {
  return {
    id: row.id,
    rfpId: row.rfp_id,
    kind: row.kind as RequirementKind,
    label: row.label,
    description: row.description,
    pageLimit: row.page_limit,
    wordLimit: row.word_limit,
    format: row.format as RfpRequirement["format"],
    requiredSections: row.required_sections ?? [],
    weightPct: toNum(row.weight_pct),
    required: row.required,
    approvedBy: row.approved_by,
    approvedAt: row.approved_at,
    extractedBy: row.extracted_by,
    extractionConfidence: toNum(row.extraction_confidence),
    sourceQuote: row.source_quote,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ── Read ─────────────────────────────────────────────────────────────────────

/** Get all requirements for one RFP, grouped naturally for UI rendering. */
export async function getRequirementsByRfp(rfpId: string): Promise<RfpRequirement[]> {
  const { data, error } = await supabase
    .from("rfp_requirements")
    .select(SELECT_COLS)
    .eq("rfp_id", rfpId)
    .order("kind", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) throw new Error(`[rfp-requirements] getByRfp: ${error.message}`);
  return ((data ?? []) as unknown as RfpRequirementRow[]).map(rowToRequirement);
}

/** Get just the approved deliverables — what the proposal generator should produce. */
export async function getApprovedDeliverables(rfpId: string): Promise<RfpRequirement[]> {
  const { data, error } = await supabase
    .from("rfp_requirements")
    .select(SELECT_COLS)
    .eq("rfp_id", rfpId)
    .eq("kind", "deliverable")
    .not("approved_at", "is", null);

  if (error) throw new Error(`[rfp-requirements] getApprovedDeliverables: ${error.message}`);
  return ((data ?? []) as unknown as RfpRequirementRow[]).map(rowToRequirement);
}

/** True when the RFP is ready for generation: TOR verified + every required deliverable approved. */
export async function isRfpReadyForGeneration(rfpId: string): Promise<{
  ready: boolean;
  reason: string | null;
  unapprovedCount: number;
}> {
  // TOR check — pulled from rfp_opportunities directly
  const { data: rfp, error: rfpErr } = await supabase
    .from("rfp_opportunities")
    .select("tor_verified_at")
    .eq("notion_page_id", rfpId)
    .single();
  if (rfpErr) throw new Error(`[rfp-requirements] isReady tor check: ${rfpErr.message}`);
  if (!rfp?.tor_verified_at) {
    return { ready: false, reason: "TOR not yet verified", unapprovedCount: 0 };
  }

  // All required deliverables must be approved
  const { data: rows, error } = await supabase
    .from("rfp_requirements")
    .select("approved_at")
    .eq("rfp_id", rfpId)
    .eq("kind", "deliverable")
    .eq("required", true);
  if (error) throw new Error(`[rfp-requirements] isReady deliverables check: ${error.message}`);

  const total = rows?.length ?? 0;
  const unapproved = (rows ?? []).filter((r) => !r.approved_at).length;
  if (total === 0) {
    return { ready: false, reason: "no deliverables extracted yet", unapprovedCount: 0 };
  }
  if (unapproved > 0) {
    return { ready: false, reason: `${unapproved} deliverable(s) not yet approved`, unapprovedCount: unapproved };
  }
  return { ready: true, reason: null, unapprovedCount: 0 };
}

// ── Write ────────────────────────────────────────────────────────────────────

export interface NewRequirement {
  rfpId: string;
  kind: RequirementKind;
  label: string;
  description?: string | null;
  pageLimit?: number | null;
  wordLimit?: number | null;
  format?: RfpRequirement["format"];
  requiredSections?: string[];
  weightPct?: number | null;
  required?: boolean;
  extractedBy?: string | null;
  extractionConfidence?: number | null;
  sourceQuote?: string | null;
}

/** Bulk insert — used by the requirement extractor after TOR parse. */
export async function insertRequirements(rows: NewRequirement[]): Promise<RfpRequirement[]> {
  if (rows.length === 0) return [];
  const payload = rows.map((r) => ({
    rfp_id:                r.rfpId,
    kind:                  r.kind,
    label:                 r.label,
    description:           r.description ?? null,
    page_limit:            r.pageLimit ?? null,
    word_limit:            r.wordLimit ?? null,
    format:                r.format ?? null,
    required_sections:     r.requiredSections ?? [],
    weight_pct:            r.weightPct ?? null,
    required:              r.required ?? true,
    extracted_by:          r.extractedBy ?? null,
    extraction_confidence: r.extractionConfidence ?? null,
    source_quote:          r.sourceQuote ?? null,
  }));
  const { data, error } = await supabase
    .from("rfp_requirements")
    .insert(payload)
    .select(SELECT_COLS);
  if (error) throw new Error(`[rfp-requirements] insert: ${error.message}`);
  return ((data ?? []) as unknown as RfpRequirementRow[]).map(rowToRequirement);
}

/** Approve a single requirement row. */
export async function approveRequirement(
  requirementId: string,
  approverEmail: string,
): Promise<void> {
  const { error } = await supabase
    .from("rfp_requirements")
    .update({ approved_by: approverEmail, approved_at: new Date().toISOString() })
    .eq("id", requirementId);
  if (error) throw new Error(`[rfp-requirements] approve: ${error.message}`);
}

/** Edit a requirement row (label, params, etc.) — clears approval since the row changed. */
export async function updateRequirement(
  requirementId: string,
  fields: Partial<Omit<NewRequirement, "rfpId">> & { resetApproval?: boolean },
): Promise<RfpRequirement> {
  const update: Record<string, unknown> = {};
  if (fields.kind !== undefined) update.kind = fields.kind;
  if (fields.label !== undefined) update.label = fields.label;
  if (fields.description !== undefined) update.description = fields.description;
  if (fields.pageLimit !== undefined) update.page_limit = fields.pageLimit;
  if (fields.wordLimit !== undefined) update.word_limit = fields.wordLimit;
  if (fields.format !== undefined) update.format = fields.format;
  if (fields.requiredSections !== undefined) update.required_sections = fields.requiredSections;
  if (fields.weightPct !== undefined) update.weight_pct = fields.weightPct;
  if (fields.required !== undefined) update.required = fields.required;
  if (fields.resetApproval) {
    update.approved_at = null;
    update.approved_by = null;
  }
  const { data, error } = await supabase
    .from("rfp_requirements")
    .update(update)
    .eq("id", requirementId)
    .select(SELECT_COLS)
    .single();
  if (error) throw new Error(`[rfp-requirements] update: ${error.message}`);
  return rowToRequirement(data as unknown as RfpRequirementRow);
}

/** Delete a requirement (e.g. "this row is wrong, get rid of it"). */
export async function deleteRequirement(requirementId: string): Promise<void> {
  const { error } = await supabase
    .from("rfp_requirements")
    .delete()
    .eq("id", requirementId);
  if (error) throw new Error(`[rfp-requirements] delete: ${error.message}`);
}

/** Wipe all extracted-by-AI requirements for an RFP — used on TOR re-upload before re-extraction. */
export async function clearExtractedRequirements(rfpId: string): Promise<number> {
  const { error, count } = await supabase
    .from("rfp_requirements")
    .delete({ count: "exact" })
    .eq("rfp_id", rfpId)
    .like("extracted_by", "claude:%");
  if (error) throw new Error(`[rfp-requirements] clearExtracted: ${error.message}`);
  return count ?? 0;
}
