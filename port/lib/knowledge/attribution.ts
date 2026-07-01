/**
 * Attribution data layer for the /brain adjudicator tab.
 *
 * Fetches all co-created nodes with their current cv-entry + member context,
 * and the full list of cv-entries for the reassignment combobox.
 */

import { supabase } from "@/lib/supabase/client";

export interface AttributionRecord {
  nodeId: string;
  nodeLabel: string;
  nodeCategory: "deliverable" | "cv-entry" | string;
  contributingAgents: string[];
  currentCvEntryId: string | null;
  currentCvEntryLabel: string | null;
  currentMemberId: string | null;
  currentMemberLabel: string | null;
  sourceRef: string | null;
  adjudicatorEditedAt: string | null;
}

export interface CvEntryOption {
  id: string;
  label: string;
  memberId: string | null;
  memberLabel: string | null;
}

interface NodeRow {
  id: string;
  label: string;
  category: string;
  attrs: Record<string, unknown> | null;
  source_ref: string | null;
}

interface EdgeRow {
  source_id: string;
  target_id: string;
  relationship: string;
}

export async function fetchAttributionData(): Promise<{
  records: AttributionRecord[];
  cvEntryOptions: CvEntryOption[];
}> {
  // 5 parallel queries — assembled in-memory
  const [coCreatedRes, fedIntoRes, authoredRes, memberRes, cvEntryRes] = await Promise.all([
    supabase
      .from("knowledge_nodes")
      .select("id, label, category, attrs, source_ref")
      .eq("kind", "co-created"),

    supabase
      .from("knowledge_edges")
      .select("source_id, target_id, relationship")
      .eq("relationship", "fed-into"),

    supabase
      .from("knowledge_edges")
      .select("source_id, target_id, relationship")
      .eq("relationship", "authored"),

    supabase
      .from("knowledge_nodes")
      .select("id, label, category, attrs, source_ref")
      .eq("category", "member"),

    supabase
      .from("knowledge_nodes")
      .select("id, label, category, attrs, source_ref")
      .eq("category", "cv-entry"),
  ]);

  if (coCreatedRes.error) throw new Error(`fetchAttributionData coCreated: ${coCreatedRes.error.message}`);
  if (fedIntoRes.error) throw new Error(`fetchAttributionData fedInto: ${fedIntoRes.error.message}`);
  if (authoredRes.error) throw new Error(`fetchAttributionData authored: ${authoredRes.error.message}`);
  if (memberRes.error) throw new Error(`fetchAttributionData members: ${memberRes.error.message}`);
  if (cvEntryRes.error) throw new Error(`fetchAttributionData cvEntries: ${cvEntryRes.error.message}`);

  const coCreatedNodes: NodeRow[] = coCreatedRes.data ?? [];
  const fedIntoEdges: EdgeRow[] = fedIntoRes.data ?? [];
  const authoredEdges: EdgeRow[] = authoredRes.data ?? [];
  const memberNodes: NodeRow[] = memberRes.data ?? [];
  const cvEntryNodes: NodeRow[] = cvEntryRes.data ?? [];

  // Build lookup maps
  const memberById = new Map(memberNodes.map((m) => [m.id, m.label]));

  // cv-entry → member (via authored edge: member → cv-entry, so target_id = cv-entry)
  const cvEntryToMember = new Map<string, string>();
  for (const e of authoredEdges) {
    cvEntryToMember.set(e.target_id, e.source_id);
  }

  // co-created node → fed-into target (cv-entry)
  // prefer source: "adjudicator" edges over "notion-cv" (already in the join as separate rows)
  const coCreatedIds = new Set(coCreatedNodes.map((n) => n.id));
  const fedIntoMap = new Map<string, string>();
  for (const e of fedIntoEdges) {
    if (coCreatedIds.has(e.source_id)) {
      fedIntoMap.set(e.source_id, e.target_id);
    }
  }

  // cv-entry label lookup
  const cvEntryLabelById = new Map(cvEntryNodes.map((e) => [e.id, e.label]));

  // Assemble records
  const records: AttributionRecord[] = coCreatedNodes.map((node) => {
    const attrs = node.attrs ?? {};
    // deliverable nodes use contributingAgents; cv-entry nodes use agentContributors
    const contributingAgents = Array.isArray(attrs.contributingAgents)
      ? (attrs.contributingAgents as string[])
      : Array.isArray(attrs.agentContributors)
      ? (attrs.agentContributors as string[])
      : [];
    const currentCvEntryId = fedIntoMap.get(node.id) ?? (attrs.appliedInEntry as string | null) ?? null;
    const currentCvEntryLabel = currentCvEntryId ? (cvEntryLabelById.get(currentCvEntryId) ?? null) : null;
    const currentMemberId = currentCvEntryId ? (cvEntryToMember.get(currentCvEntryId) ?? null) : null;
    const currentMemberLabel = currentMemberId ? (memberById.get(currentMemberId) ?? null) : null;

    return {
      nodeId: node.id,
      nodeLabel: node.label,
      nodeCategory: node.category,
      contributingAgents,
      currentCvEntryId,
      currentCvEntryLabel,
      currentMemberId,
      currentMemberLabel,
      sourceRef: node.source_ref,
      adjudicatorEditedAt: typeof attrs.adjudicatorEditedAt === "string" ? attrs.adjudicatorEditedAt : null,
    };
  });

  // Sort: unreviewed (no adjudicatorEditedAt, no member) first; then alphabetical by label
  records.sort((a, b) => {
    const aReviewed = a.adjudicatorEditedAt !== null;
    const bReviewed = b.adjudicatorEditedAt !== null;
    if (aReviewed !== bReviewed) return aReviewed ? 1 : -1;
    return a.nodeLabel.localeCompare(b.nodeLabel);
  });

  // Build cv-entry options: sorted with Garrett (garrett/gj) first, then alpha by member label
  const cvEntryOptions: CvEntryOption[] = cvEntryNodes.map((e) => {
    const memberId = cvEntryToMember.get(e.id) ?? null;
    const memberLabel = memberId ? (memberById.get(memberId) ?? null) : null;
    return { id: e.id, label: e.label, memberId, memberLabel };
  });

  cvEntryOptions.sort((a, b) => {
    // Garrett's entries first (id contains "garrett" or member label contains "Garrett")
    const aGarrett = a.memberLabel?.toLowerCase().includes("garrett") ?? false;
    const bGarrett = b.memberLabel?.toLowerCase().includes("garrett") ?? false;
    if (aGarrett !== bGarrett) return aGarrett ? -1 : 1;
    // then by member name, then entry label
    const memberCmp = (a.memberLabel ?? "").localeCompare(b.memberLabel ?? "");
    if (memberCmp !== 0) return memberCmp;
    return a.label.localeCompare(b.label);
  });

  return { records, cvEntryOptions };
}
