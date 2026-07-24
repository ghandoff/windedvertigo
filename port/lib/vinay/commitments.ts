/**
 * vinay personal commitment ledger — things garrett said he'd do, in any
 * channel (work or personal). Simplified cousin of pam_commitments: no owner
 * column (audience of one), no whirlpool/board fields (me-only, phase 0).
 */

import { vinayDb } from "./client";

export type VinayCommitmentStatus =
  | "not-started"
  | "in-progress"
  | "blocked"
  | "done"
  | "parked";

export interface VinayCommitment {
  id: string;
  created_at: string;
  what: string;
  due_date: string | null;
  source: string | null;
  status: VinayCommitmentStatus;
  channel: string | null;
  completed_at: string | null;
  updated_at: string;
}

export async function createVinayCommitment(data: {
  what: string;
  due_date?: string | null;
  source?: string | null;
  channel?: string | null;
}): Promise<{ id: string; created_at: string }> {
  const { data: row, error } = await vinayDb
    .from("vinay_commitments")
    .insert({
      what: data.what,
      due_date: data.due_date ?? null,
      source: data.source ?? null,
      channel: data.channel ?? null,
    })
    .select("id, created_at")
    .single();
  if (error) throw error;
  return row;
}

export async function listVinayCommitments(
  opts: { status?: VinayCommitmentStatus; openOnly?: boolean; limit?: number } = {},
): Promise<VinayCommitment[]> {
  let query = vinayDb
    .from("vinay_commitments")
    .select("*")
    .order("due_date", { ascending: true, nullsFirst: false })
    .limit(opts.limit ?? 200);
  if (opts.status) query = query.eq("status", opts.status);
  else if (opts.openOnly) query = query.not("status", "in", "(done,parked)");
  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

export async function updateVinayCommitment(
  id: string,
  patch: {
    status?: VinayCommitmentStatus;
    due_date?: string | null;
    completed_at?: string | null;
  },
): Promise<VinayCommitment> {
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.status) update.status = patch.status;
  if (patch.due_date !== undefined) update.due_date = patch.due_date;
  if (patch.completed_at !== undefined) update.completed_at = patch.completed_at;
  // auto-stamp completion when marking done without an explicit timestamp
  if (patch.status === "done" && patch.completed_at === undefined) {
    update.completed_at = new Date().toISOString();
  }
  const { data, error } = await vinayDb
    .from("vinay_commitments")
    .update(update)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return data;
}
