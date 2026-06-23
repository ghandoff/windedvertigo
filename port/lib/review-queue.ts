/**
 * Review queue — the human-in-the-loop buffer for email-driven changes.
 *
 * The outcome/payment scanners propose changes here; nothing touches `deals` or
 * RFP status until someone approves the item at /inbox. Approval routes back
 * through the same durable write paths a human would use (transitionRfpStatus /
 * updateDealRevenue), so the queue is purely a confirmation gate.
 */

import { supabase } from "@/lib/supabase/client";

export type ReviewKind = "rfp_outcome" | "payment";
export type ReviewStatus = "pending" | "approved" | "dismissed";

export interface ReviewItem {
  id: string;
  kind: ReviewKind;
  rfpId: string | null;
  dealId: string | null;
  proposed: Record<string, unknown>;
  summary: string;
  source: string;
  sourceEmailId: string | null;
  status: ReviewStatus;
  createdAt: string;
  resolvedAt: string | null;
  resolvedBy: string | null;
}

interface ReviewRow {
  id: string;
  kind: ReviewKind;
  rfp_id: string | null;
  deal_id: string | null;
  proposed: Record<string, unknown>;
  summary: string;
  source: string;
  source_email_id: string | null;
  status: ReviewStatus;
  created_at: string;
  resolved_at: string | null;
  resolved_by: string | null;
}

function mapRow(r: ReviewRow): ReviewItem {
  return {
    id: r.id,
    kind: r.kind,
    rfpId: r.rfp_id,
    dealId: r.deal_id,
    proposed: r.proposed,
    summary: r.summary,
    source: r.source,
    sourceEmailId: r.source_email_id,
    status: r.status,
    createdAt: r.created_at,
    resolvedAt: r.resolved_at,
    resolvedBy: r.resolved_by,
  };
}

export interface EnqueueInput {
  kind: ReviewKind;
  rfpId?: string;
  dealId?: string;
  proposed: Record<string, unknown>;
  summary: string;
  sourceEmailId?: string;
  source?: string;
}

/**
 * Enqueue a proposed change. Idempotent on (source_email_id, kind): a re-scan of
 * the same email won't create a duplicate. Returns true if a new row was created.
 *
 * Uses check-then-insert rather than upsert/ON CONFLICT: the dedup index is
 * PARTIAL (`where source_email_id is not null`), which PostgREST cannot use as an
 * ON CONFLICT target. The cron is single-threaded daily, so the check is safe; the
 * partial unique index remains as a DB-level backstop.
 */
export async function enqueueReviewItem(input: EnqueueInput): Promise<boolean> {
  if (input.sourceEmailId) {
    const { data: existing } = await supabase
      .from("review_queue")
      .select("id")
      .eq("source_email_id", input.sourceEmailId)
      .eq("kind", input.kind)
      .limit(1);
    if (existing && existing.length) return false;
  }
  const { error } = await supabase.from("review_queue").insert({
    kind: input.kind,
    rfp_id: input.rfpId ?? null,
    deal_id: input.dealId ?? null,
    proposed: input.proposed,
    summary: input.summary,
    source: input.source ?? "email",
    source_email_id: input.sourceEmailId ?? null,
  });
  if (error) throw new Error(`[review-queue] enqueue: ${error.message}`);
  return true;
}

export async function listReviewItems(status: ReviewStatus = "pending"): Promise<ReviewItem[]> {
  const { data, error } = await supabase
    .from("review_queue")
    .select("*")
    .eq("status", status)
    .order("created_at", { ascending: false });
  if (error) throw new Error(`[review-queue] list: ${error.message}`);
  return (data as ReviewRow[]).map(mapRow);
}

export async function getReviewItem(id: string): Promise<ReviewItem | null> {
  const { data, error } = await supabase.from("review_queue").select("*").eq("id", id).single();
  if (error) {
    if (error.code === "PGRST116") return null;
    throw new Error(`[review-queue] get: ${error.message}`);
  }
  return data ? mapRow(data as ReviewRow) : null;
}

export async function countPendingReviews(): Promise<number> {
  const { count, error } = await supabase
    .from("review_queue")
    .select("*", { count: "exact", head: true })
    .eq("status", "pending");
  if (error) throw new Error(`[review-queue] count: ${error.message}`);
  return count ?? 0;
}

export async function resolveReviewItem(
  id: string,
  status: Exclude<ReviewStatus, "pending">,
  by: string,
): Promise<void> {
  const { error } = await supabase
    .from("review_queue")
    .update({ status, resolved_at: new Date().toISOString(), resolved_by: by })
    .eq("id", id);
  if (error) throw new Error(`[review-queue] resolve: ${error.message}`);
}
