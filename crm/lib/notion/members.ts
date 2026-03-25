/**
 * Members data layer — reads active w.v collective members.
 * Used for "logged by" dropdowns and team assignment fields.
 */

import {
  getTitle,
  getText,
  getCheckbox,
  getEmail,
  queryDatabase,
  type PageObjectResponse,
} from "@windedvertigo/notion";

import { notion, CRM_DB, MEMBER_PROPS } from "./client";
import { buildCheckboxFilter } from "./filters";

const P = MEMBER_PROPS;

export interface Member {
  id: string;
  name: string;
  email: string;
  companyRole: string;
  active: boolean;
}

function mapPageToMember(page: PageObjectResponse): Member {
  const props = page.properties;
  return {
    id: page.id,
    name: getTitle(props[P.name]),
    email: getEmail(props[P.email]),
    companyRole: getText(props[P.companyRole]),
    active: getCheckbox(props[P.active]),
  };
}

/** Get all active members. Cached for 5 minutes in server components. */
export async function getActiveMembers(): Promise<Member[]> {
  const result = await queryDatabase(notion, {
    database_id: CRM_DB.members,
    filter: buildCheckboxFilter(P.active, true),
    sorts: [{ property: P.name, direction: "ascending" }],
    page_size: 20,
    label: "getActiveMembers",
  });

  return result.pages.map(mapPageToMember);
}

/** Get just the first names of active members (lowercase). */
export async function getActiveMemberNames(): Promise<string[]> {
  const members = await getActiveMembers();
  return members.map((m) => m.name.split(" ")[0].toLowerCase());
}
