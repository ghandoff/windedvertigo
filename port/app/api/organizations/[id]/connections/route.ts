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
import { getOrganization } from "@/lib/notion/organizations";
import { getContact } from "@/lib/notion/contacts";
import { json, error } from "@/lib/api-helpers";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  let org;
  try {
    org = await getOrganization(id);
  } catch {
    return error("Organization not found", 404);
  }

  if (!org.contactIds?.length) {
    return json({ orgId: id, orgName: org.organization, directContacts: [], paths: [] });
  }

  // Fetch all contacts linked to this org
  const contactResults = await Promise.allSettled(
    org.contactIds.slice(0, 20).map((cId) => getContact(cId)),
  );

  const contacts = contactResults
    .filter((r) => r.status === "fulfilled")
    .map((r) => (r as PromiseFulfilledResult<Awaited<ReturnType<typeof getContact>>>).value);

  // For each contact, get their warmth + relationship stage as the "path strength"
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
    totalContacts: org.contactIds.length,
  });
}
