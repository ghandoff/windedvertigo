/**
 * Supabase read layer for members — used when MEMBERS_SOURCE=supabase.
 *
 * Maps Supabase rows back to the canonical `Member` type from lib/notion/members.
 * Critically: `id` is set to `notion_page_id` (not the Supabase UUID) so all
 * callers that match against Notion relation arrays continue to work unchanged.
 */

import { supabase } from "./client";
import type { Member, MemberCapacity } from "@/lib/notion/members";

interface MemberRow {
  notion_page_id: string;
  name: string;
  email: string | null;
  company_role: string | null;
  active: boolean;
  capacity: string | null;
  hourly_rate: number | null;
}

function mapRowToMember(row: MemberRow): Member {
  return {
    id: row.notion_page_id,
    name: row.name,
    email: row.email ?? "",
    companyRole: row.company_role ?? "",
    active: row.active,
    capacity: (row.capacity as MemberCapacity) ?? null,
    hourlyRate: row.hourly_rate ?? null,
  };
}

const SELECT_COLS =
  "notion_page_id, name, email, company_role, active, capacity, hourly_rate";

export async function getActiveMembersFromSupabase(): Promise<Member[]> {
  const { data, error } = await supabase
    .from("members")
    .select(SELECT_COLS)
    .eq("active", true)
    .order("name", { ascending: true });

  if (error) throw new Error(`[supabase/members] getActiveMembers: ${error.message}`);
  return (data as MemberRow[]).map(mapRowToMember);
}
