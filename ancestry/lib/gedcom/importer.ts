/**
 * GEDCOM importer — takes parsed GEDCOM data and inserts into our database.
 *
 * maps GEDCOM's indirect FAM model to our direct relationship model:
 *   FAM.HUSB + FAM.WIFE → spouse relationship
 *   FAM.HUSB + FAM.CHIL → biological_parent relationship
 *   FAM.WIFE + FAM.CHIL → biological_parent relationship
 */

import { getDb } from "../db";
import { parseGedcom, parseGedcomDate, type ParsedGedcom } from "./parser";

export async function importGedcom(treeId: string, gedcomText: string) {
  const sql = getDb();
  const parsed = parseGedcom(gedcomText);

  // map GEDCOM xrefs to our UUIDs
  const xrefToId = new Map<string, string>();

  // 1. insert persons
  for (const p of parsed.persons) {
    const display = [p.givenNames, p.surname].filter(Boolean).join(" ") || "unknown";

    const person = await sql`
      INSERT INTO persons (tree_id, sex, is_living, notes)
      VALUES (${treeId}, ${p.sex}, ${p.isLiving}, ${p.notes})
      RETURNING id
    `;
    const personId = person[0].id;
    xrefToId.set(p.xref, personId);

    // insert name
    await sql`
      INSERT INTO person_names (person_id, name_type, given_names, surname, display, is_primary)
      VALUES (${personId}, 'birth', ${p.givenNames}, ${p.surname}, ${display}, true)
    `;

    // insert birth event
    if (p.birthDate) {
      const fuzzy = parseGedcomDate(p.birthDate);
      if (fuzzy) {
        await sql`
          INSERT INTO events (person_id, event_type, date, sort_date, is_primary)
          VALUES (${personId}, 'birth', ${JSON.stringify(fuzzy)}, ${fuzzy.date}, true)
        `;
      }
    }

    // insert death event
    if (p.deathDate) {
      const fuzzy = parseGedcomDate(p.deathDate);
      if (fuzzy) {
        await sql`
          INSERT INTO events (person_id, event_type, date, sort_date, is_primary)
          VALUES (${personId}, 'death', ${JSON.stringify(fuzzy)}, ${fuzzy.date}, true)
        `;
      }
    }
  }

  // 2. process families → relationships
  for (const fam of parsed.families) {
    const husbId = fam.husbXref ? xrefToId.get(fam.husbXref) : null;
    const wifeId = fam.wifeXref ? xrefToId.get(fam.wifeXref) : null;

    // spouse relationship
    if (husbId && wifeId) {
      await sql`
        INSERT INTO relationships (tree_id, person1_id, person2_id, relationship_type)
        VALUES (${treeId}, ${husbId}, ${wifeId}, 'spouse')
        ON CONFLICT (person1_id, person2_id, relationship_type) DO NOTHING
      `;
    }

    // parent-child relationships
    for (const childXref of fam.childXrefs) {
      const childId = xrefToId.get(childXref);
      if (!childId) continue;

      if (husbId) {
        await sql`
          INSERT INTO relationships (tree_id, person1_id, person2_id, relationship_type)
          VALUES (${treeId}, ${husbId}, ${childId}, 'biological_parent')
          ON CONFLICT (person1_id, person2_id, relationship_type) DO NOTHING
        `;
      }

      if (wifeId) {
        await sql`
          INSERT INTO relationships (tree_id, person1_id, person2_id, relationship_type)
          VALUES (${treeId}, ${wifeId}, ${childId}, 'biological_parent')
          ON CONFLICT (person1_id, person2_id, relationship_type) DO NOTHING
        `;
      }
    }

    // marriage event (attach to both spouses)
    if (fam.marriageDate) {
      const fuzzy = parseGedcomDate(fam.marriageDate);
      if (fuzzy) {
        for (const id of [husbId, wifeId].filter(Boolean)) {
          await sql`
            INSERT INTO events (person_id, event_type, date, sort_date, description)
            VALUES (${id}, 'marriage', ${JSON.stringify(fuzzy)}, ${fuzzy.date}, ${fam.marriagePlace ?? null})
          `;
        }
      }
    }
  }

  return {
    personsImported: parsed.persons.length,
    familiesImported: parsed.families.length,
  };
}
