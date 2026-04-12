"use server";

import { auth } from "@windedvertigo/auth";
import {
  getOrCreateTree,
  getTreePersons,
  getTreeRelationships,
} from "@/lib/db/queries";
import { formatFuzzyDate } from "@/lib/db";
import type { Person, Relationship } from "@/lib/types";
import { PARENT_TYPES } from "@/lib/types";

// ---------------------------------------------------------------------------
// shared helpers
// ---------------------------------------------------------------------------

function displayName(p: Person): string {
  const primary = p.names.find((n) => n.is_primary) ?? p.names[0];
  if (!primary) return "(unnamed)";
  return (primary.display ?? [primary.given_names, primary.surname].filter(Boolean).join(" ")) || "(unnamed)";
}

function eventSummary(p: Person) {
  return p.events.map((e) => ({
    type: e.event_type,
    date: formatFuzzyDate(e.date),
    description: e.description ?? "",
  }));
}

function personSummary(p: Person) {
  return {
    id: p.id,
    name: displayName(p),
    sex: p.sex,
    isLiving: p.is_living,
    events: eventSummary(p),
  };
}

export type PersonSummary = ReturnType<typeof personSummary>;

// ---------------------------------------------------------------------------
// report types
// ---------------------------------------------------------------------------

export type FamilyGroupSheetData = {
  type: "family_group_sheet";
  principal: PersonSummary;
  spouses: {
    person: PersonSummary;
    children: PersonSummary[];
  }[];
};

export type AncestorReportData = {
  type: "ancestor_report";
  principal: PersonSummary;
  ancestors: { number: number; person: PersonSummary; generation: number }[];
};

export type DescendantReportData = {
  type: "descendant_report";
  principal: PersonSummary;
  descendants: { person: PersonSummary; depth: number }[];
};

export type ReportData =
  | FamilyGroupSheetData
  | AncestorReportData
  | DescendantReportData;

export type ReportResult =
  | { ok: true; data: ReportData }
  | { ok: false; error: string };

// ---------------------------------------------------------------------------
// main action
// ---------------------------------------------------------------------------

export async function generateReportAction(
  personId: string,
  reportType: "family_group_sheet" | "ancestor_report" | "descendant_report",
): Promise<ReportResult> {
  const session = await auth();
  if (!session?.user?.email) return { ok: false, error: "not authenticated" };

  const tree = await getOrCreateTree(session.user.email);
  const [persons, relationships] = await Promise.all([
    getTreePersons(tree.id as string),
    getTreeRelationships(tree.id as string),
  ]);

  const personMap = new Map<string, Person>(persons.map((p) => [p.id, p]));
  const principal = personMap.get(personId);
  if (!principal) return { ok: false, error: "person not found" };

  switch (reportType) {
    case "family_group_sheet":
      return { ok: true, data: buildFamilyGroupSheet(principal, relationships, personMap) };
    case "ancestor_report":
      return { ok: true, data: buildAncestorReport(principal, relationships, personMap) };
    case "descendant_report":
      return { ok: true, data: buildDescendantReport(principal, relationships, personMap) };
  }
}

// ---------------------------------------------------------------------------
// family group sheet
// ---------------------------------------------------------------------------

function buildFamilyGroupSheet(
  principal: Person,
  relationships: Relationship[],
  personMap: Map<string, Person>,
): FamilyGroupSheetData {
  // find spouses
  const spouseIds: string[] = [];
  for (const rel of relationships) {
    if (["spouse", "partner", "ex_spouse"].includes(rel.relationship_type)) {
      if (rel.person1_id === principal.id) spouseIds.push(rel.person2_id);
      else if (rel.person2_id === principal.id) spouseIds.push(rel.person1_id);
    }
  }

  // for each spouse, find shared children (children of principal who are also children of that spouse)
  const childrenOfPrincipal = new Set<string>();
  for (const rel of relationships) {
    if (PARENT_TYPES.includes(rel.relationship_type) && rel.person1_id === principal.id) {
      childrenOfPrincipal.add(rel.person2_id);
    }
  }

  const spouses = spouseIds.map((sid) => {
    const spousePerson = personMap.get(sid);
    const childrenOfSpouse = new Set<string>();
    for (const rel of relationships) {
      if (PARENT_TYPES.includes(rel.relationship_type) && rel.person1_id === sid) {
        childrenOfSpouse.add(rel.person2_id);
      }
    }
    // shared children
    const sharedChildren = [...childrenOfPrincipal].filter((cid) => childrenOfSpouse.has(cid));
    return {
      person: spousePerson ? personSummary(spousePerson) : { id: sid, name: "(unknown)", sex: null as Person["sex"], isLiving: false, events: [] },
      children: sharedChildren
        .map((cid) => personMap.get(cid))
        .filter((c): c is Person => !!c)
        .map(personSummary),
    };
  });

  // also include children with no known other parent
  const allClaimedChildren = new Set(spouses.flatMap((s) => s.children.map((c) => c.id)));
  const unpairedChildren = [...childrenOfPrincipal]
    .filter((cid) => !allClaimedChildren.has(cid))
    .map((cid) => personMap.get(cid))
    .filter((c): c is Person => !!c)
    .map(personSummary);

  if (unpairedChildren.length > 0) {
    spouses.push({
      person: { id: "", name: "(no known spouse)", sex: null, isLiving: false, events: [] },
      children: unpairedChildren,
    });
  }

  return {
    type: "family_group_sheet",
    principal: personSummary(principal),
    spouses,
  };
}

// ---------------------------------------------------------------------------
// ancestor report (ahnentafel)
// ---------------------------------------------------------------------------

function buildAncestorReport(
  principal: Person,
  relationships: Relationship[],
  personMap: Map<string, Person>,
): AncestorReportData {
  // build child -> parents map
  const parentOf = new Map<string, { fatherId?: string; motherId?: string }>();
  for (const rel of relationships) {
    if (!PARENT_TYPES.includes(rel.relationship_type)) continue;
    const parentPerson = personMap.get(rel.person1_id);
    if (!parentPerson) continue;
    const entry = parentOf.get(rel.person2_id) ?? {};
    if (parentPerson.sex === "M" && !entry.fatherId) entry.fatherId = rel.person1_id;
    else if (parentPerson.sex === "F" && !entry.motherId) entry.motherId = rel.person1_id;
    else if (!entry.fatherId) entry.fatherId = rel.person1_id;
    else if (!entry.motherId) entry.motherId = rel.person1_id;
    parentOf.set(rel.person2_id, entry);
  }

  const ancestors: { number: number; person: PersonSummary; generation: number }[] = [];
  const maxGen = 5;

  function walk(personId: string, ahnNum: number, gen: number) {
    const person = personMap.get(personId);
    if (!person) return;
    if (gen > 0) {
      ancestors.push({ number: ahnNum, person: personSummary(person), generation: gen });
    }
    if (gen >= maxGen) return;
    const parents = parentOf.get(personId);
    if (parents?.fatherId) walk(parents.fatherId, ahnNum * 2, gen + 1);
    if (parents?.motherId) walk(parents.motherId, ahnNum * 2 + 1, gen + 1);
  }

  walk(principal.id, 1, 0);
  ancestors.sort((a, b) => a.number - b.number);

  return {
    type: "ancestor_report",
    principal: personSummary(principal),
    ancestors,
  };
}

// ---------------------------------------------------------------------------
// descendant report
// ---------------------------------------------------------------------------

function buildDescendantReport(
  principal: Person,
  relationships: Relationship[],
  personMap: Map<string, Person>,
): DescendantReportData {
  // build parent -> children map
  const childrenOf = new Map<string, string[]>();
  for (const rel of relationships) {
    if (!PARENT_TYPES.includes(rel.relationship_type)) continue;
    const list = childrenOf.get(rel.person1_id) ?? [];
    list.push(rel.person2_id);
    childrenOf.set(rel.person1_id, list);
  }

  const descendants: { person: PersonSummary; depth: number }[] = [];
  const visited = new Set<string>();
  const maxDepth = 5;

  function walk(personId: string, depth: number) {
    if (visited.has(personId) || depth > maxDepth) return;
    visited.add(personId);
    const kids = childrenOf.get(personId) ?? [];
    for (const kid of kids) {
      const child = personMap.get(kid);
      if (child) {
        descendants.push({ person: personSummary(child), depth });
        walk(kid, depth + 1);
      }
    }
  }

  walk(principal.id, 1);

  return {
    type: "descendant_report",
    principal: personSummary(principal),
    descendants,
  };
}
