/**
 * GET /api/organizations/[id]/connections
 *
 * Returns the warm intro paths to a target organization:
 * - Direct contacts: people already in port linked to this org
 * - Second-degree: contacts linked to this org who are also linked to OTHER orgs
 *   where we have existing relationships (connection != "unengaged")
 *
 * This is a graph traversal: team → known contacts → target org
 */

import { NextRequest } from "next/server";
import { getOrganizationByIdFromSupabase } from "@/lib/supabase/organizations";
import { getContactsFromSupabase } from "@/lib/supabase/contacts";
import { json, error } from "@/lib/api-helpers";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const org = await getOrganizationByIdFromSupabase(id);
  if (!org) return error("Organization not found", 404);

  // Query contacts linked to this org directly — avoids the N+1 that the
  // Notion version had (iterate contactIds → fetch each contact one by one).
  const { data: contacts } = await getContactsFromSupabase(
    { orgId: id },
    { pageSize: 20 },
  );

  if (!contacts.length) {
    return json({ orgId: id, orgName: org.organization, directContacts: [], paths: [] });
  }

  // For each contact, surface warmth + relationship stage as the "path strength"
  const directContacts = contacts.map((c) => ({
    id: c.id,
    name: c.name,
    role: c.role,
    email: c.email,
    linkedin: c.linkedin,
    contactWarmth: c.contactWarmth,
    relationshipStage: c.relationshipStage,
    organizationIds: c.organizationIds,
  }));

  // Sort by warmth (hot > warm > lukewarm > cold)
  const warmthOrder = { hot: 0, warm: 1, lukewarm: 2, cold: 3 };
  directContacts.sort(
    (a, b) =>
      (warmthOrder[a.contactWarmth as keyof typeof warmthOrder] ?? 4) -
      (warmthOrder[b.contactWarmth as keyof typeof warmthOrder] ?? 4),
  );

  return json({
    orgId: id,
    orgName: org.organization,
    directContacts,
    totalContacts: contacts.length,
  });
}
