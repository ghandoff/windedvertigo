/**
 * Members data layer — reads active w.v collective members.
 * Used for "logged by" dropdowns and team assignment fields.
 */

import {
  getTitle,
  getText,
  getSelect,
  getCheckbox,
  getEmail,
  getNumber,
  queryDatabase,
  type PageObjectResponse,
} from "@/lib/shared/notion";

import { notion, PORT_DB, MEMBER_PROPS } from "./client";
import { getActiveMembersFromSupabase } from "@/lib/supabase/members";

const P = MEMBER_PROPS;

export type MemberCapacity =
  | "full-time"
  | "as needed"
  | "part-time (75%)"
  | "part-time (50%)"
  | "part-time (25%)"
  | "6 hours per week"
  | "former employee";

/** Weekly hours implied by each capacity tier. */
export const CAPACITY_HOURS: Record<MemberCapacity, number> = {
  "full-time": 40,
  "part-time (75%)": 30,
  "part-time (50%)": 20,
  "part-time (25%)": 10,
  "6 hours per week": 6,
  "as needed": 10, // conservative baseline for variable members
  "former employee": 0,
};

export interface Member {
  id: string;
  name: string;
  email: string;
  companyRole: string;
  active: boolean;
  /** Expected weekly availability. */
  capacity: MemberCapacity | null;
  /** Standard hourly rate for time entries (null if unset). */
  hourlyRate: number | null;
}

function mapPageToMember(page: PageObjectResponse): Member {
  const props = page.properties;
  return {
    id: page.id,
    name: getTitle(props[P.name]),
    email: getEmail(props[P.email]),
    companyRole: getText(props[P.companyRole]),
    active: getCheckbox(props[P.active]),
    capacity: (getSelect(props[P.capacity]) || null) as MemberCapacity | null,
    hourlyRate: getNumber(props[P.hourlyRate]),
  };
}

/** Get all active members. Sourced from Supabase (Notion → Supabase nightly sync). */
export async function getActiveMembers(): Promise<Member[]> {
  return getActiveMembersFromSupabase();
}

/** Get just the first names of active members (lowercase). */
export async function getActiveMemberNames(): Promise<string[]> {
  const members = await getActiveMembers();
  return members.map((m) => m.name.split(" ")[0].toLowerCase());
}

/** Get all members (active + inactive) — used by the Supabase sync cron. */
export async function getAllMembers(): Promise<Member[]> {
  const result = await queryDatabase(notion, {
    database_id: PORT_DB.members,
    sorts: [{ property: P.name, direction: "ascending" }],
    page_size: 100,
    label: "getAllMembers",
  });
  return result.pages.map(mapPageToMember);
}
