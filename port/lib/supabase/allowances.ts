/**
 * Supabase read layer for allowances — replaces direct Notion reads.
 *
 * Maps Supabase rows back to the canonical `Allowance` type from
 * lib/notion/allowances. Critically:
 * - `id` is set to `notion_page_id` (not the Supabase UUID) so all callers
 *   that match against Notion-relation arrays continue to work unchanged.
 * - `memberIds` is rehydrated from Supabase member UUIDs back to Notion
 *   page IDs by joining against the `members` table, since the canonical
 *   contract (matching Member.id) is Notion-page-ID-based.
 */

import { supabase } from "./client";
import type { Allowance, AllowanceCategory } from "@/lib/notion/allowances";

interface AllowanceRow {
  notion_page_id: string;
  description: string;
  category: string | null;
  amount: number | null;
  active: boolean;
  notes: string | null;
  member_ids: string[] | null;
}

const SELECT_COLS =
  "notion_page_id, description, category, amount, active, notes, member_ids";

function mapRowToAllowance(
  row: AllowanceRow,
  memberUuidToNotionId: Map<string, string>,
): Allowance {
  const memberIds = (row.member_ids ?? [])
    .map((uuid) => memberUuidToNotionId.get(uuid))
    .filter((id): id is string => id !== undefined);

  return {
    id: row.notion_page_id,
    description: row.description,
    memberIds,
    category: (row.category as AllowanceCategory) || "other",
    amount: row.amount,
    active: row.active,
    notes: row.notes ?? "",
  };
}

async function loadMemberUuidMap(): Promise<Map<string, string>> {
  const { data, error } = await supabase
    .from("members")
    .select("id, notion_page_id");
  if (error)
    throw new Error(`[supabase/allowances] loadMemberUuidMap: ${error.message}`);
  type Row = { id: string; notion_page_id: string };
  return new Map((data ?? []).map((r: Row) => [r.id, r.notion_page_id]));
}

export async function getActiveAllowancesFromSupabase(): Promise<Allowance[]> {
  const memberMap = await loadMemberUuidMap();
  const { data, error } = await supabase
    .from("allowances")
    .select(SELECT_COLS)
    .eq("active", true)
    .order("description", { ascending: true });

  if (error)
    throw new Error(`[supabase/allowances] getActiveAllowances: ${error.message}`);
  return (data as AllowanceRow[]).map((row) => mapRowToAllowance(row, memberMap));
}

export async function getAllAllowancesFromSupabase(): Promise<Allowance[]> {
  const memberMap = await loadMemberUuidMap();
  const { data, error } = await supabase
    .from("allowances")
    .select(SELECT_COLS)
    .order("description", { ascending: true });

  if (error)
    throw new Error(`[supabase/allowances] getAllAllowances: ${error.message}`);
  return (data as AllowanceRow[]).map((row) => mapRowToAllowance(row, memberMap));
}
