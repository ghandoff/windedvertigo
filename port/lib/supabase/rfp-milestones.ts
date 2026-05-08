/**
 * Supabase layer for rfp_milestones — the working-backward schedule per RFP.
 *
 * Auto-generated when bid_decision='bid' from the RFP's deadline using the
 * standard template (submission, Garrett final pass, internal review, SME
 * draft due, initial draft generated). The hourly cron at
 * /api/cron/milestone-reminders DMs owners 24h before each milestone is due.
 */

import { supabase } from "./client";

export type MilestoneStatus =
  | "pending"
  | "in-progress"
  | "done"
  | "slipped"
  | "cancelled";

export interface RfpMilestone {
  id: string;
  rfpId: string;
  label: string;
  dueAt: string;
  ownerEmail: string | null;
  status: MilestoneStatus;
  reminderSentAt: string | null;
  createdAt: string;
}

interface RfpMilestoneRow {
  id: string;
  rfp_id: string;
  label: string;
  due_at: string;
  owner_email: string | null;
  status: string;
  reminder_sent_at: string | null;
  created_at: string;
}

const SELECT_COLS = "id, rfp_id, label, due_at, owner_email, status, reminder_sent_at, created_at";

function rowToMilestone(row: RfpMilestoneRow): RfpMilestone {
  return {
    id: row.id,
    rfpId: row.rfp_id,
    label: row.label,
    dueAt: row.due_at,
    ownerEmail: row.owner_email,
    status: row.status as MilestoneStatus,
    reminderSentAt: row.reminder_sent_at,
    createdAt: row.created_at,
  };
}

// ── Read ─────────────────────────────────────────────────────────────────────

export async function getMilestonesByRfp(rfpId: string): Promise<RfpMilestone[]> {
  const { data, error } = await supabase
    .from("rfp_milestones")
    .select(SELECT_COLS)
    .eq("rfp_id", rfpId)
    .order("due_at", { ascending: true });
  if (error) throw new Error(`[rfp-milestones] getByRfp: ${error.message}`);
  return ((data ?? []) as unknown as RfpMilestoneRow[]).map(rowToMilestone);
}

/**
 * Find milestones whose `due_at` is within the next `hoursAhead` window AND
 * haven't had a reminder sent yet AND are still pending. Used by the reminder cron.
 */
export async function getMilestonesDueWithin(
  hoursAhead: number,
): Promise<RfpMilestone[]> {
  const now = new Date();
  const horizon = new Date(now.getTime() + hoursAhead * 3600 * 1000);
  const { data, error } = await supabase
    .from("rfp_milestones")
    .select(SELECT_COLS)
    .eq("status", "pending")
    .is("reminder_sent_at", null)
    .gte("due_at", now.toISOString())
    .lte("due_at", horizon.toISOString())
    .order("due_at", { ascending: true });
  if (error) throw new Error(`[rfp-milestones] getDueWithin: ${error.message}`);
  return ((data ?? []) as unknown as RfpMilestoneRow[]).map(rowToMilestone);
}

// ── Write ────────────────────────────────────────────────────────────────────

export interface NewMilestone {
  rfpId: string;
  label: string;
  dueAt: string;     // ISO timestamp
  ownerEmail?: string | null;
}

export async function insertMilestones(rows: NewMilestone[]): Promise<RfpMilestone[]> {
  if (rows.length === 0) return [];
  const payload = rows.map((r) => ({
    rfp_id:      r.rfpId,
    label:       r.label,
    due_at:      r.dueAt,
    owner_email: r.ownerEmail ?? null,
  }));
  const { data, error } = await supabase
    .from("rfp_milestones")
    .insert(payload)
    .select(SELECT_COLS);
  if (error) throw new Error(`[rfp-milestones] insert: ${error.message}`);
  return ((data ?? []) as unknown as RfpMilestoneRow[]).map(rowToMilestone);
}

export async function setMilestoneStatus(
  milestoneId: string,
  status: MilestoneStatus,
): Promise<void> {
  const { error } = await supabase
    .from("rfp_milestones")
    .update({ status })
    .eq("id", milestoneId);
  if (error) throw new Error(`[rfp-milestones] setStatus: ${error.message}`);
}

export async function markReminderSent(milestoneId: string): Promise<void> {
  const { error } = await supabase
    .from("rfp_milestones")
    .update({ reminder_sent_at: new Date().toISOString() })
    .eq("id", milestoneId);
  if (error) throw new Error(`[rfp-milestones] markReminderSent: ${error.message}`);
}

/**
 * Generate the standard working-backward milestone schedule for an RFP given
 * its deadline. If `deadline - now < 7 days`, compress the schedule
 * proportionally so milestones don't end up in the past.
 *
 * Standard template:
 *   - Submission              T-0
 *   - Garrett final pass      T-1d
 *   - Internal review done    T-3d
 *   - SME draft due           T-5d
 *   - Initial draft generated T-7d
 *
 * Returns the rows to insert; caller decides when (e.g. on bid_decision='bid').
 */
export function buildMilestoneSchedule(
  rfpId: string,
  deadlineIso: string,
  ownerEmail: string,
): NewMilestone[] {
  const deadline = new Date(deadlineIso);
  const now = new Date();
  const totalMs = deadline.getTime() - now.getTime();
  const totalDays = totalMs / (24 * 3600 * 1000);

  // Default offsets (days before deadline)
  const template: Array<{ label: string; offsetDays: number; owner?: string }> = [
    { label: "Initial draft generated",   offsetDays: 7, owner: "(system)" },
    { label: "SME draft contributions due", offsetDays: 5 },  // owner = per-contributor; left null here
    { label: "Internal review complete",  offsetDays: 3 },
    { label: "Garrett final pass",        offsetDays: 1 },
    { label: "Submission",                offsetDays: 0 },
  ];

  // Compression factor when < 7 days
  const factor = totalDays < 7 ? Math.max(0.3, totalDays / 7) : 1;

  return template.map((t) => {
    const offsetMs = t.offsetDays * factor * 24 * 3600 * 1000;
    const dueAt = new Date(deadline.getTime() - offsetMs).toISOString();
    return {
      rfpId,
      label: t.label,
      dueAt,
      ownerEmail: t.owner ?? ownerEmail,
    };
  });
}
