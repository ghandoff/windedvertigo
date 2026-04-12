/**
 * GEDCOM 7.0 exporter
 *
 * key differences from 5.5.1:
 * - BOM + "0 HEAD" with GEDC.VERS 7.0
 * - uses SCHMA for extension tags
 * - NAME structure uses PERSONAL_NAME_PIECES (TYPE instead of separate name records)
 * - SEX tag accepts "X" (non-binary) in addition to M/F/U
 * - void xrefs allowed (@VOID@)
 * - EXID for external identifiers
 * - better source/citation structure
 * - UTF-8 only (no CHAR tag needed)
 */

import type { Person, PersonName, PersonEvent, Relationship, Source } from "../types";
import type { FuzzyDate } from "../db";

const GEDCOM_MONTHS = [
  "JAN", "FEB", "MAR", "APR", "MAY", "JUN",
  "JUL", "AUG", "SEP", "OCT", "NOV", "DEC",
];

const PARENT_TYPES = [
  "biological_parent", "adoptive_parent", "foster_parent", "step_parent", "guardian",
];

const SPOUSE_TYPES = ["spouse", "partner", "ex_spouse"];

function formatDate(fd: FuzzyDate): string {
  const d = new Date(fd.date + "T00:00:00");
  if (isNaN(d.getTime())) return "";

  const year = d.getUTCFullYear();
  const month = GEDCOM_MONTHS[d.getUTCMonth()];
  const day = d.getUTCDate();

  switch (fd.precision) {
    case "year":
      return `${year}`;
    case "month":
      return `${month} ${year}`;
    case "exact":
      return `${day} ${month} ${year}`;
    case "about":
      return `ABT ${day} ${month} ${year}`;
    case "before":
      return `BEF ${day} ${month} ${year}`;
    case "after":
      return `AFT ${day} ${month} ${year}`;
    case "between": {
      let base = `BET ${day} ${month} ${year}`;
      if (fd.date_to) {
        const d2 = new Date(fd.date_to + "T00:00:00");
        if (!isNaN(d2.getTime())) {
          base += ` AND ${d2.getUTCDate()} ${GEDCOM_MONTHS[d2.getUTCMonth()]} ${d2.getUTCFullYear()}`;
        }
      }
      return base;
    }
    default:
      return `${day} ${month} ${year}`;
  }
}

function formatName(name: PersonName): string {
  const given = name.given_names ?? "";
  const surname = name.surname ?? "";
  return `${given} /${surname}/`.trim();
}

function eventTag(eventType: string): string | null {
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
    case "naturalization": return "NATU";
    case "military": return "EVEN";
    case "education": return "EDUC";
    default: return null;
  }
}

type FamilyGroup = {
  parent1Id: string | null;
  parent2Id: string | null;
  childIds: string[];
  marriageEvent: PersonEvent | null;
};

function buildFamilyGroups(persons: Person[], relationships: Relationship[]): FamilyGroup[] {
  const personMap = new Map<string, Person>();
  for (const p of persons) personMap.set(p.id, p);

  const spousePairs = new Map<string, { p1: string; p2: string; rel: Relationship }>();
  for (const rel of relationships) {
    if (!SPOUSE_TYPES.includes(rel.relationship_type)) continue;
    const key = [rel.person1_id, rel.person2_id].sort().join("|");
    if (!spousePairs.has(key)) {
      spousePairs.set(key, { p1: rel.person1_id, p2: rel.person2_id, rel });
    }
  }

  const childParents = new Map<string, Set<string>>();
  for (const rel of relationships) {
    if (!PARENT_TYPES.includes(rel.relationship_type)) continue;
    const parents = childParents.get(rel.person2_id) ?? new Set();
    parents.add(rel.person1_id);
    childParents.set(rel.person2_id, parents);
  }

  const families: FamilyGroup[] = [];
  const childAssigned = new Set<string>();

  for (const [, pair] of spousePairs) {
    const children: string[] = [];
    for (const [childId, parents] of childParents) {
      if (parents.has(pair.p1) && parents.has(pair.p2)) {
        children.push(childId);
        childAssigned.add(childId);
      }
    }

    const p1 = personMap.get(pair.p1);
    const p2 = personMap.get(pair.p2);
    let parent1Id = pair.p1;
    let parent2Id = pair.p2;
    if (p2?.sex === "M" && p1?.sex !== "M") {
      parent1Id = pair.p2;
      parent2Id = pair.p1;
    }

    let marriageEvent: PersonEvent | null = null;
    for (const sp of [p1, p2]) {
      if (!sp) continue;
      const evt = sp.events.find((e) => e.event_type === "marriage");
      if (evt) { marriageEvent = evt; break; }
    }

    families.push({ parent1Id, parent2Id, childIds: children, marriageEvent });
  }

  // single-parent families
  const singleParentFamilies = new Map<string, string[]>();
  for (const rel of relationships) {
    if (!PARENT_TYPES.includes(rel.relationship_type)) continue;
    if (childAssigned.has(rel.person2_id)) continue;
    const parents = childParents.get(rel.person2_id);
    if (!parents || parents.size > 1) continue;
    const list = singleParentFamilies.get(rel.person1_id) ?? [];
    list.push(rel.person2_id);
    singleParentFamilies.set(rel.person1_id, list);
    childAssigned.add(rel.person2_id);
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

  return families;
}

export type ExportOptions7 = {
  redactLiving?: boolean;
  includeSources?: boolean;
};

/**
 * Export to GEDCOM 7.0 format
 */
export function exportGedcom7(
  persons: Person[],
  relationships: Relationship[],
  sources: Source[] = [],
  options: ExportOptions7 = {},
): string {
  const { redactLiving = true, includeSources = true } = options;

  const lines: string[] = [];

  // GEDCOM 7.0 requires UTF-8 BOM
  // (we'll prepend it when creating the file)

  // assign xrefs
  const personXref = new Map<string, string>();
  let counter = 1;
  for (const p of persons) {
    personXref.set(p.id, `@I${counter}@`);
    counter++;
  }

  const sourceXref = new Map<string, string>();
  let srcCounter = 1;
  for (const s of sources) {
    sourceXref.set(s.id, `@S${srcCounter}@`);
    srcCounter++;
  }

  const families = buildFamilyGroups(persons, relationships);
  const famXrefs = families.map((_, i) => `@F${i + 1}@`);

  // person -> family lookups
  const personFams = new Map<string, string[]>();
  const personFamc = new Map<string, string[]>();

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

  // --- HEADER (GEDCOM 7.0) ---
  lines.push("0 HEAD");
  lines.push("1 GEDC");
  lines.push("2 VERS 7.0");
  lines.push("1 SOUR WINDEDVERTIGO");
  lines.push("2 NAME w.v ancestry");
  lines.push("2 VERS 0.1.0");
  // SCHMA for extension tags
  lines.push("1 SCHMA");
  lines.push("2 TAG _DNA https://windedvertigo.com/gedcom/dna");

  // --- INDI records ---
  for (const person of persons) {
    const xref = personXref.get(person.id)!;
    lines.push(`0 ${xref} INDI`);

    // names — GEDCOM 7.0 uses TYPE substructure for name variants
    for (const name of person.names) {
      lines.push(`1 NAME ${formatName(name)}`);
      if (name.given_names) lines.push(`2 GIVN ${name.given_names}`);
      if (name.surname) lines.push(`2 SURN ${name.surname}`);
      if (name.prefix) lines.push(`2 NPFX ${name.prefix}`);
      if (name.suffix) lines.push(`2 NSFX ${name.suffix}`);
      // GEDCOM 7.0 name type
      if (name.name_type === "married") lines.push("2 TYPE MARRIED");
      else if (name.name_type === "birth") lines.push("2 TYPE BIRTH");
      else if (name.name_type === "adopted") lines.push("2 TYPE IMMIGRANT");
      else if (name.name_type === "alias") lines.push("2 TYPE AKA");
    }

    // sex — GEDCOM 7.0 supports X
    lines.push(`1 SEX ${person.sex ?? "U"}`);

    // EXID — external identifier (our UUID)
    lines.push(`1 EXID ${person.id}`);
    lines.push("2 TYPE https://windedvertigo.com/ancestry/person");

    // events
    const shouldRedact = redactLiving && person.is_living;
    if (!shouldRedact) {
      for (const evt of person.events) {
        const tag = eventTag(evt.event_type);
        if (!tag) continue;

        if (tag === "EVEN") {
          lines.push("1 EVEN");
          lines.push(`2 TYPE ${evt.event_type}`);
        } else {
          lines.push(`1 ${tag}`);
        }

        if (evt.date) {
          const dateStr = formatDate(evt.date as FuzzyDate);
          if (dateStr) lines.push(`2 DATE ${dateStr}`);
        }
        if (evt.description) {
          lines.push(`2 PLAC ${evt.description}`);
        }
      }
    }

    // DNA data as extension tag
    if ((person as any).dna_data) {
      const dna = (person as any).dna_data;
      lines.push("1 _DNA");
      if (dna.ethnicity) {
        for (const eth of dna.ethnicity) {
          lines.push(`2 NOTE ${eth.region}: ${eth.percentage}%`);
        }
      }
      if (dna.maternalHaplogroup) lines.push(`2 NOTE mtDNA: ${dna.maternalHaplogroup}`);
      if (dna.paternalHaplogroup) lines.push(`2 NOTE Y-DNA: ${dna.paternalHaplogroup}`);
    }

    // family references
    for (const famRef of personFams.get(person.id) ?? []) {
      lines.push(`1 FAMS ${famRef}`);
    }
    for (const famRef of personFamc.get(person.id) ?? []) {
      lines.push(`1 FAMC ${famRef}`);
    }

    // notes
    if (person.notes && !shouldRedact) {
      lines.push(`1 NOTE ${person.notes.replace(/\n/g, "\n2 CONT ")}`);
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

    if (fam.marriageEvent?.date) {
      lines.push("1 MARR");
      const dateStr = formatDate(fam.marriageEvent.date as FuzzyDate);
      if (dateStr) lines.push(`2 DATE ${dateStr}`);
      if (fam.marriageEvent.description) {
        lines.push(`2 PLAC ${fam.marriageEvent.description}`);
      }
    }
  }

  // --- SOURCE records ---
  if (includeSources) {
    for (const source of sources) {
      const xref = sourceXref.get(source.id)!;
      lines.push(`0 ${xref} SOUR`);
      lines.push(`1 TITL ${source.title}`);
      if (source.author) lines.push(`1 AUTH ${source.author}`);
      if (source.publisher) lines.push(`1 PUBL ${source.publisher}`);
      if (source.url) lines.push(`1 WWW ${source.url}`);
      if (source.notes) lines.push(`1 NOTE ${source.notes.replace(/\n/g, "\n2 CONT ")}`);
      // EXID
      lines.push(`1 EXID ${source.id}`);
      lines.push("2 TYPE https://windedvertigo.com/ancestry/source");
    }
  }

  // --- TRAILER ---
  lines.push("0 TRLR");

  return "\uFEFF" + lines.join("\n") + "\n";
}
