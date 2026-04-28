/**
 * GEDCOM 5.5.1 exporter
 *
 * converts our internal data model back to GEDCOM 5.5.1 format.
 * reverses the importer's mapping:
 *   spouse relationship → FAM record (HUSB + WIFE)
 *   biological_parent relationship → FAM record (parent + CHIL)
 */

import type { Person, PersonName, PersonEvent, Relationship } from "../types";
import type { FuzzyDate } from "../db/utils";

const GEDCOM_MONTHS = [
  "JAN", "FEB", "MAR", "APR", "MAY", "JUN",
  "JUL", "AUG", "SEP", "OCT", "NOV", "DEC",
];

const PARENT_TYPES = [
  "biological_parent", "adoptive_parent", "foster_parent", "step_parent", "guardian",
];

const SPOUSE_TYPES = ["spouse", "partner", "ex_spouse"];

/** convert a FuzzyDate to GEDCOM date string */
function formatGedcomDate(fd: FuzzyDate): string {
  const d = new Date(fd.date + "T00:00:00");
  if (isNaN(d.getTime())) return "";

  const year = d.getUTCFullYear();
  const month = GEDCOM_MONTHS[d.getUTCMonth()];
  const day = d.getUTCDate();

  let base = "";
  switch (fd.precision) {
    case "year":
      base = `${year}`;
      break;
    case "month":
      base = `${month} ${year}`;
      break;
    case "exact":
      base = `${day} ${month} ${year}`;
      break;
    case "about":
      base = `ABT ${day} ${month} ${year}`;
      break;
    case "before":
      base = `BEF ${day} ${month} ${year}`;
      break;
    case "after":
      base = `AFT ${day} ${month} ${year}`;
      break;
    case "between":
      base = `BET ${day} ${month} ${year}`;
      if (fd.date_to) {
        const d2 = new Date(fd.date_to + "T00:00:00");
        if (!isNaN(d2.getTime())) {
          base += ` AND ${d2.getUTCDate()} ${GEDCOM_MONTHS[d2.getUTCMonth()]} ${d2.getUTCFullYear()}`;
        }
      }
      break;
    default:
      base = `${day} ${month} ${year}`;
  }

  return base;
}

/** format a PersonName as GEDCOM NAME value: "Given /Surname/" */
function formatGedcomName(name: PersonName): string {
  const given = name.given_names ?? "";
  const surname = name.surname ?? "";
  return `${given} /${surname}/`.trim();
}

type FamilyGroup = {
  parent1Id: string | null;
  parent2Id: string | null;
  childIds: string[];
  marriageEvent: PersonEvent | null;
};

/** build FAM groups from our flat relationship model */
function buildFamilyGroups(
  persons: Person[],
  relationships: Relationship[],
): FamilyGroup[] {
  const personMap = new Map<string, Person>();
  for (const p of persons) personMap.set(p.id, p);

  // collect spouse pairs
  const spousePairs = new Map<string, { p1: string; p2: string; rel: Relationship }>();
  for (const rel of relationships) {
    if (!SPOUSE_TYPES.includes(rel.relationship_type)) continue;
    // canonical key: sorted ids
    const key = [rel.person1_id, rel.person2_id].sort().join("|");
    if (!spousePairs.has(key)) {
      spousePairs.set(key, { p1: rel.person1_id, p2: rel.person2_id, rel });
    }
  }

  // collect parent-child edges: parent -> child
  const parentChildEdges: { parentId: string; childId: string }[] = [];
  // child -> set of parent ids
  const childParents = new Map<string, Set<string>>();

  for (const rel of relationships) {
    if (!PARENT_TYPES.includes(rel.relationship_type)) continue;
    // person1 is parent of person2
    parentChildEdges.push({ parentId: rel.person1_id, childId: rel.person2_id });
    const parents = childParents.get(rel.person2_id) ?? new Set();
    parents.add(rel.person1_id);
    childParents.set(rel.person2_id, parents);
  }

  const families: FamilyGroup[] = [];
  const childAssigned = new Set<string>(); // track children assigned to a couple family

  // 1. build families from spouse pairs
  for (const [, pair] of spousePairs) {
    const children: string[] = [];
    // find children whose parents include both members of this pair
    for (const [childId, parents] of childParents) {
      if (parents.has(pair.p1) && parents.has(pair.p2)) {
        children.push(childId);
        childAssigned.add(childId);
      }
    }

    // determine husb/wife by sex for GEDCOM compat
    const p1 = personMap.get(pair.p1);
    const p2 = personMap.get(pair.p2);
    let parent1Id = pair.p1;
    let parent2Id = pair.p2;

    // GEDCOM uses HUSB/WIFE — assign by sex if possible
    if (p2?.sex === "M" && p1?.sex !== "M") {
      parent1Id = pair.p2;
      parent2Id = pair.p1;
    }

    // find marriage event on either spouse
    let marriageEvent: PersonEvent | null = null;
    for (const sp of [p1, p2]) {
      if (!sp) continue;
      const evt = sp.events.find((e) => e.event_type === "marriage");
      if (evt) { marriageEvent = evt; break; }
    }

    families.push({ parent1Id, parent2Id, childIds: children, marriageEvent });
  }

  // 2. handle single-parent families (children not yet assigned)
  const singleParentFamilies = new Map<string, string[]>();

  for (const edge of parentChildEdges) {
    if (childAssigned.has(edge.childId)) continue;
    const parents = childParents.get(edge.childId);
    if (!parents || parents.size > 1) continue; // skip if multiple parents but no couple match
    const list = singleParentFamilies.get(edge.parentId) ?? [];
    list.push(edge.childId);
    singleParentFamilies.set(edge.parentId, list);
    childAssigned.add(edge.childId);
  }

  for (const [parentId, childIds] of singleParentFamilies) {
    const parent = personMap.get(parentId);
    const isMale = parent?.sex === "M";
    families.push({
      parent1Id: isMale ? parentId : null,
      parent2Id: isMale ? null : parentId,
      childIds,
      marriageEvent: null,
    });
  }

  // 3. handle children with 2 parents who aren't a spouse pair
  for (const [childId, parents] of childParents) {
    if (childAssigned.has(childId)) continue;
    const parentArr = [...parents];
    if (parentArr.length >= 2) {
      // create a family for the first two parents
      const p1 = personMap.get(parentArr[0]);
      const p2 = personMap.get(parentArr[1]);
      let parent1Id = parentArr[0];
      let parent2Id = parentArr[1];
      if (p2?.sex === "M" && p1?.sex !== "M") {
        parent1Id = parentArr[1];
        parent2Id = parentArr[0];
      }
      families.push({ parent1Id, parent2Id, childIds: [childId], marriageEvent: null });
      childAssigned.add(childId);
    }
  }

  return families;
}

export type ExportOptions = {
  /** if true, strip dates/places for living persons */
  redactLiving?: boolean;
};

/** export persons and relationships to GEDCOM 5.5.1 format */
export function exportGedcom(
  persons: Person[],
  relationships: Relationship[],
  options: ExportOptions = {},
): string {
  const { redactLiving = true } = options;

  const lines: string[] = [];

  // assign stable INDI xrefs
  const personXref = new Map<string, string>();
  let indiCounter = 1;
  for (const p of persons) {
    personXref.set(p.id, `@I${indiCounter}@`);
    indiCounter++;
  }

  // build family groups
  const families = buildFamilyGroups(persons, relationships);

  // assign FAM xrefs
  const famXrefs: string[] = [];
  for (let i = 0; i < families.length; i++) {
    famXrefs.push(`@F${i + 1}@`);
  }

  // build person -> FAMS/FAMC lookup
  const personFams = new Map<string, string[]>(); // family as spouse
  const personFamc = new Map<string, string[]>(); // family as child

  for (let i = 0; i < families.length; i++) {
    const fam = families[i];
    const xref = famXrefs[i];

    for (const parentId of [fam.parent1Id, fam.parent2Id]) {
      if (!parentId) continue;
      const list = personFams.get(parentId) ?? [];
      list.push(xref);
      personFams.set(parentId, list);
    }

    for (const childId of fam.childIds) {
      const list = personFamc.get(childId) ?? [];
      list.push(xref);
      personFamc.set(childId, list);
    }
  }

  // --- HEADER ---
  lines.push("0 HEAD");
  lines.push("1 SOUR WindedVertigo");
  lines.push("2 VERS 0.1.0");
  lines.push("1 GEDC");
  lines.push("2 VERS 5.5.1");
  lines.push("2 FORM LINEAGE-LINKED");
  lines.push("1 CHAR UTF-8");

  // --- INDI records ---
  for (const person of persons) {
    const xref = personXref.get(person.id)!;
    lines.push(`0 ${xref} INDI`);

    const primaryName = person.names.find((n) => n.is_primary) ?? person.names[0];
    if (primaryName) {
      lines.push(`1 NAME ${formatGedcomName(primaryName)}`);
      if (primaryName.given_names) lines.push(`2 GIVN ${primaryName.given_names}`);
      if (primaryName.surname) lines.push(`2 SURN ${primaryName.surname}`);
      if (primaryName.prefix) lines.push(`2 NPFX ${primaryName.prefix}`);
      if (primaryName.suffix) lines.push(`2 NSFX ${primaryName.suffix}`);
    }

    // sex
    let sex = person.sex ?? "U";
    if (sex === "X") sex = "U"; // GEDCOM 5.5.1 doesn't have X
    lines.push(`1 SEX ${sex}`);

    // events — skip for living persons if redacting
    const shouldRedact = redactLiving && person.is_living;

    if (!shouldRedact) {
      for (const evt of person.events) {
        const tag = eventTypeToTag(evt.event_type);
        if (!tag) continue;

        lines.push(`1 ${tag}`);
        if (evt.date) {
          const fd = evt.date as FuzzyDate;
          const dateStr = formatGedcomDate(fd);
          if (dateStr) lines.push(`2 DATE ${dateStr}`);
        }
        if (evt.description) {
          lines.push(`2 NOTE ${evt.description}`);
        }
      }
    }

    // FAMS references
    for (const famRef of personFams.get(person.id) ?? []) {
      lines.push(`1 FAMS ${famRef}`);
    }

    // FAMC references
    for (const famRef of personFamc.get(person.id) ?? []) {
      lines.push(`1 FAMC ${famRef}`);
    }
  }

  // --- FAM records ---
  for (let i = 0; i < families.length; i++) {
    const fam = families[i];
    const xref = famXrefs[i];

    lines.push(`0 ${xref} FAM`);

    if (fam.parent1Id) {
      const ref = personXref.get(fam.parent1Id);
      if (ref) lines.push(`1 HUSB ${ref}`);
    }
    if (fam.parent2Id) {
      const ref = personXref.get(fam.parent2Id);
      if (ref) lines.push(`1 WIFE ${ref}`);
    }
    for (const childId of fam.childIds) {
      const ref = personXref.get(childId);
      if (ref) lines.push(`1 CHIL ${ref}`);
    }

    // marriage event
    if (fam.marriageEvent?.date) {
      const fd = fam.marriageEvent.date as FuzzyDate;
      lines.push("1 MARR");
      const dateStr = formatGedcomDate(fd);
      if (dateStr) lines.push(`2 DATE ${dateStr}`);
      if (fam.marriageEvent.description) {
        lines.push(`2 PLAC ${fam.marriageEvent.description}`);
      }
    }
  }

  // --- TRAILER ---
  lines.push("0 TRLR");

  return lines.join("\n") + "\n";
}

/** map our event_type to GEDCOM tag */
function eventTypeToTag(eventType: string): string | null {
  switch (eventType) {
    case "birth": return "BIRT";
    case "death": return "DEAT";
    case "marriage": return "MARR";
    case "burial": return "BURI";
    case "baptism": return "BAPM";
    case "christening": return "CHR";
    case "emigration": return "EMIG";
    case "immigration": return "IMMI";
    case "census": return "CENS";
    case "graduation": return "GRAD";
    case "retirement": return "RETI";
    case "residence": return "RESI";
    case "occupation": return "OCCU";
    default: return null;
  }
}
