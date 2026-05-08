/**
 * Supabase layer for rfp_assignments — per-contributor task tracking.
 *
 * Created when a proposal is generated (one row per named team member with
 * tasks like "review section X", "verify your CV"). The post-generation
 * Slack DM fan-out reads these and DMs each assignee.
 *
 * `requirement_id` may be NULL for cross-cutting tasks (CV verify, "do a final
 * read-through"). When set, the assignment ties to a specific deliverable
 * requirement and contributes to the rfp_coverage view.
 */

import { supabase } from "./client";

export type AssignmentStatus =
  | "pending"
  | "in-progress"
  | "done"
  | "declined"
  | "cancelled";

export interface RfpAssignment {
  id: string;
  rfpId: string;
  requirementId: string | null;
  taskLabel: string;
  assigneeEmail: string;
  dueAt: string | null;
  status: AssignmentStatus;
  notifiedAt: string | null;
  ackedAt: string | null;
  notes: string | null;
  createdAt: string;
}

interface RfpAssignmentRow {
  id: string;
  rfp_id: string;
  requirement_id: string | null;
  task_label: string;
  assignee_email: string;
  due_at: string | null;
  status: string;
  notified_at: string | null;
  acked_at: string | null;
  notes: string | null;
  created_at: string;
}

const SELECT_COLS = "id, rfp_id, requirement_id, task_label, assignee_email, due_at, status, notified_at, acked_at, notes, created_at";

function rowToAssignment(row: RfpAssignmentRow): RfpAssignment {
  return {
    id: row.id,
    rfpId: row.rfp_id,
    requirementId: row.requirement_id,
    taskLabel: row.task_label,
    assigneeEmail: row.assignee_email,
    dueAt: row.due_at,
    status: row.status as AssignmentStatus,
    notifiedAt: row.notified_at,
    ackedAt: row.acked_at,
    notes: row.notes,
    createdAt: row.created_at,
  };
}

// ── Read ─────────────────────────────────────────────────────────────────────

export async function getAssignmentsByRfp(rfpId: string): Promise<RfpAssignment[]> {
  const { data, error } = await supabase
    .from("rfp_assignments")
    .select(SELECT_COLS)
    .eq("rfp_id", rfpId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(`[rfp-assignments] getByRfp: ${error.message}`);
  return ((data ?? []) as unknown as RfpAssignmentRow[]).map(rowToAssignment);
}

export async function getAssignmentsByEmail(
  email: string,
  status?: AssignmentStatus,
): Promise<RfpAssignment[]> {
  let q = supabase.from("rfp_assignments").select(SELECT_COLS).eq("assignee_email", email);
  if (status) q = q.eq("status", status);
  const { data, error } = await q.order("due_at", { ascending: true, nullsFirst: false });
  if (error) throw new Error(`[rfp-assignments] getByEmail: ${error.message}`);
  return ((data ?? []) as unknown as RfpAssignmentRow[]).map(rowToAssignment);
}

/** Distinct assignee emails for an RFP (used by Slack DM fan-out). */
export async function getDistinctAssigneesByRfp(rfpId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from("rfp_assignments")
    .select("assignee_email")
    .eq("rfp_id", rfpId);
  if (error) throw new Error(`[rfp-assignments] distinctAssignees: ${error.message}`);
  const set = new Set<string>();
  for (const r of data ?? []) {
    if (r.assignee_email) set.add(r.assignee_email as string);
  }
  return Array.from(set);
}

// ── Write ────────────────────────────────────────────────────────────────────

export interface NewAssignment {
  rfpId: string;
  requirementId?: string | null;
  taskLabel: string;
  assigneeEmail: string;
  dueAt?: string | null;
  notes?: string | null;
}

export async function insertAssignments(rows: NewAssignment[]): Promise<RfpAssignment[]> {
  if (rows.length === 0) return [];
  const payload = rows.map((r) => ({
    rfp_id:         r.rfpId,
    requirement_id: r.requirementId ?? null,
    task_label:     r.taskLabel,
    assignee_email: r.assigneeEmail,
    due_at:         r.dueAt ?? null,
    notes:          r.notes ?? null,
  }));
  const { data, error } = await supabase
    .from("rfp_assignments")
    .insert(payload)
    .select(SELECT_COLS);
  if (error) throw new Error(`[rfp-assignments] insert: ${error.message}`);
  return ((data ?? []) as unknown as RfpAssignmentRow[]).map(rowToAssignment);
}

export async function setAssignmentStatus(
  assignmentId: string,
  status: AssignmentStatus,
  notes?: string,
): Promise<void> {
  const update: Record<string, unknown> = { status };
  if (notes !== undefined) update.notes = notes;
  if (status === "done") update.acked_at = new Date().toISOString();
  const { error } = await supabase
    .from("rfp_assignments")
    .update(update)
    .eq("id", assignmentId);
  if (error) throw new Error(`[rfp-assignments] setStatus: ${error.message}`);
}

export async function markAssignmentNotified(assignmentId: string): Promise<void> {
  const { error } = await supabase
    .from("rfp_assignments")
    .update({ notified_at: new Date().toISOString() })
    .eq("id", assignmentId);
  if (error) throw new Error(`[rfp-assignments] markNotified: ${error.message}`);
}
