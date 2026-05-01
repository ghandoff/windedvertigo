/**
 * Allowances data layer — recurring reimbursements and tool allowances.
 *
 * Each row represents a monthly expense (e.g., Claude Pro subscription)
 * that auto-generates reimbursement timesheet entries via the sync-allowances cron.
 */

import {
  getTitle,
  getCheckbox,
  getNumber,
  getRelation,
  getSelect,
  getText,
  queryDatabase,
  type PageObjectResponse,
} from "@/lib/shared/notion";

import { notion, PORT_DB, ALLOWANCE_PROPS } from "./client";
import { getActiveAllowancesFromSupabase } from "@/lib/supabase/allowances";

const P = ALLOWANCE_PROPS;

export type AllowanceCategory =
  | "subscription"
  | "tool"
  | "stipend"
  | "travel"
  | "other";

export interface Allowance {
  id: string;
  description: string;
  memberIds: string[];
  category: AllowanceCategory;
  amount: number | null;
  active: boolean;
  notes: string;
}

function mapPageToAllowance(page: PageObjectResponse): Allowance {
  const props = page.properties;
  return {
    id: page.id,
    description: getTitle(props[P.description]),
    memberIds: getRelation(props[P.member]),
    category: (getSelect(props[P.category]) || "other") as AllowanceCategory,
    amount: getNumber(props[P.amount]),
    active: getCheckbox(props[P.active]),
    notes: getText(props[P.notes]),
  };
}

/** Get all active allowances. Sourced from Supabase (Notion → Supabase nightly sync). */
export async function getActiveAllowances(): Promise<Allowance[]> {
  return getActiveAllowancesFromSupabase();
}

/** Get all allowances (active + inactive) — used by the Supabase sync cron. */
export async function getAllAllowances(): Promise<Allowance[]> {
  const result = await queryDatabase(notion, {
    database_id: PORT_DB.allowances,
    sorts: [{ property: P.description, direction: "ascending" }],
    page_size: 100,
    label: "getAllAllowances",
  });

  return result.pages.map(mapPageToAllowance);
}
