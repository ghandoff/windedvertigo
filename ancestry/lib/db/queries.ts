import { getDb } from ".";
import type { Person, PersonName, PersonEvent, Relationship, RelationshipType, TreeNode, Place, Source, Citation, PARENT_TYPES, TreeMember, TreeRole, Hint, HintStatus, ResearchTask, TaskStatus, TaskPriority } from "../types";

const PARENT_TYPE_LIST = [
  "biological_parent", "adoptive_parent", "foster_parent", "step_parent", "guardian",
];

/** get or create the default tree for a user */
export async function getOrCreateTree(ownerEmail: string) {
  const sql = getDb();

  const existing = await sql`
    SELECT id, name, description, owner_email, visibility, created_at
    FROM trees WHERE owner_email = ${ownerEmail} LIMIT 1
  `;
  if (existing.length > 0) return existing[0];

  const created = await sql`
    INSERT INTO trees (name, owner_email)
    VALUES ('my family tree', ${ownerEmail})
    RETURNING id, name, description, owner_email, visibility, created_at
  `;
  return created[0];
}

/** get all persons in a tree with their names and events */
export async function getTreePersons(treeId: string): Promise<Person[]> {
  const sql = getDb();

  const rows = await sql`
    SELECT
      p.id, p.tree_id, p.sex, p.is_living, p.privacy_level,
      p.thumbnail_url, p.notes, p.created_at, p.updated_at
    FROM persons p
    WHERE p.tree_id = ${treeId}
    ORDER BY p.created_at
  `;

  if (rows.length === 0) return [];

  const personIds = rows.map((r) => r.id);

  const names = await sql`
    SELECT id, person_id, name_type, given_names, surname,
           prefix, suffix, display, is_primary, sort_order
    FROM person_names
    WHERE person_id = ANY(${personIds})
    ORDER BY sort_order
  `;

  const events = await sql`
    SELECT id, person_id, event_type, date, sort_date,
           place_id, description, is_primary
    FROM events
    WHERE person_id = ANY(${personIds})
    ORDER BY sort_date NULLS LAST
  `;

  const namesByPerson = new Map<string, PersonName[]>();
  for (const n of names) {
    const list = namesByPerson.get(n.person_id) ?? [];
    list.push(n as PersonName);
    namesByPerson.set(n.person_id, list);
  }

  const eventsByPerson = new Map<string, PersonEvent[]>();
  for (const e of events) {
    const list = eventsByPerson.get(e.person_id) ?? [];
    list.push(e as PersonEvent);
    eventsByPerson.set(e.person_id, list);
  }

  return rows.map((r) => ({
    ...r,
    names: namesByPerson.get(r.id) ?? [],
    events: eventsByPerson.get(r.id) ?? [],
  })) as Person[];
}

/** get all relationships in a tree */
export async function getTreeRelationships(treeId: string): Promise<Relationship[]> {
  const sql = getDb();
  const rows = await sql`
    SELECT id, tree_id, person1_id, person2_id, relationship_type,
           start_date, end_date, confidence, notes
    FROM relationships
    WHERE tree_id = ${treeId}
  `;
  return rows as Relationship[];
}

/** build tree nodes from persons + relationships for chart rendering */
export function buildTreeNodes(
  persons: Person[],
  relationships: Relationship[],
): TreeNode[] {
  const parentMap = new Map<string, string[]>();  // child -> parents
  const childMap = new Map<string, string[]>();   // parent -> children
  const spouseMap = new Map<string, string[]>();  // person -> spouses

  // edge metadata keyed by "childId->parentId" or "p1--p2" (sorted for spouse)
  const parentEdgeMeta = new Map<string, { type: RelationshipType; startDate?: string | null }>();
  const spouseEdgeMeta = new Map<string, { type: RelationshipType; startDate?: string | null }>();

  function extractDateStr(d: unknown): string | null {
    if (d && typeof d === "object" && "date" in (d as Record<string, unknown>)) {
      return ((d as Record<string, unknown>).date as string)?.slice(0, 4) ?? null;
    }
    return null;
  }

  for (const rel of relationships) {
    if (PARENT_TYPE_LIST.includes(rel.relationship_type)) {
      // person1 is parent of person2
      const parents = parentMap.get(rel.person2_id) ?? [];
      parents.push(rel.person1_id);
      parentMap.set(rel.person2_id, parents);

      const children = childMap.get(rel.person1_id) ?? [];
      children.push(rel.person2_id);
      childMap.set(rel.person1_id, children);

      parentEdgeMeta.set(`${rel.person2_id}->${rel.person1_id}`, {
        type: rel.relationship_type,
        startDate: extractDateStr(rel.start_date),
      });
    } else if (["spouse", "partner", "ex_spouse"].includes(rel.relationship_type)) {
      const s1 = spouseMap.get(rel.person1_id) ?? [];
      s1.push(rel.person2_id);
      spouseMap.set(rel.person1_id, s1);

      const s2 = spouseMap.get(rel.person2_id) ?? [];
      s2.push(rel.person1_id);
      spouseMap.set(rel.person2_id, s2);

      const key = [rel.person1_id, rel.person2_id].sort().join("--");
      spouseEdgeMeta.set(key, {
        type: rel.relationship_type,
        startDate: extractDateStr(rel.start_date),
      });
    }
  }

  return persons.map((p) => {
    const primaryName = p.names.find((n) => n.is_primary) ?? p.names[0];
    const displayName = primaryName?.display
      ?? [primaryName?.given_names, primaryName?.surname].filter(Boolean).join(" ")
      ?? "unknown";

    const birth = p.events.find((e) => e.event_type === "birth");
    const death = p.events.find((e) => e.event_type === "death");

    function extractYear(evt: PersonEvent | undefined): string | null {
      if (!evt?.date) return null;
      const d = evt.date;
      if (typeof d === "object" && "date" in d) {
        return d.date.slice(0, 4);
      }
      return null;
    }

    const pIds = parentMap.get(p.id) ?? [];
    const sIds = spouseMap.get(p.id) ?? [];

    return {
      id: p.id,
      displayName,
      surname: primaryName?.surname ?? null,
      sex: p.sex,
      birthYear: extractYear(birth),
      deathYear: extractYear(death),
      thumbnailUrl: p.thumbnail_url,
      isLiving: p.is_living,
      parentIds: pIds,
      spouseIds: sIds,
      childIds: childMap.get(p.id) ?? [],
      parentEdges: pIds.map((parentId) => {
        const meta = parentEdgeMeta.get(`${p.id}->${parentId}`);
        return {
          targetId: parentId,
          type: meta?.type ?? ("biological_parent" as RelationshipType),
          startDate: meta?.startDate ?? null,
        };
      }),
      spouseEdges: sIds.map((spouseId) => {
        const key = [p.id, spouseId].sort().join("--");
        const meta = spouseEdgeMeta.get(key);
        return {
          targetId: spouseId,
          type: meta?.type ?? ("spouse" as RelationshipType),
          startDate: meta?.startDate ?? null,
        };
      }),
    };
  });
}

/** create a person with a primary name */
export async function createPerson(input: {
  treeId: string;
  sex?: string;
  isLiving?: boolean;
  givenNames: string;
  surname: string;
  middleName?: string;
  maidenName?: string;
  birthDate?: string;
  birthPlace?: string;
  deathDate?: string;
  currentResidence?: string;
}) {
  const sql = getDb();

  const person = await sql`
    INSERT INTO persons (tree_id, sex, is_living)
    VALUES (${input.treeId}, ${input.sex ?? "U"}, ${input.isLiving ?? true})
    RETURNING id
  `;

  const personId = person[0].id;

  // build given_names with middle name included (standard GEDCOM convention)
  const givenNames = [input.givenNames, input.middleName].filter(Boolean).join(" ");
  const display = [givenNames, input.surname].filter(Boolean).join(" ");

  await sql`
    INSERT INTO person_names (person_id, name_type, given_names, surname, display, is_primary, sort_order)
    VALUES (${personId}, 'birth', ${givenNames}, ${input.surname}, ${display}, true, 0)
  `;

  // if maiden name differs from surname, add a married name record
  if (input.maidenName && input.maidenName !== input.surname) {
    const maidenDisplay = [givenNames, input.maidenName].filter(Boolean).join(" ");
    // the birth name becomes the maiden name, married name becomes primary display
    // swap: birth name uses maiden surname, married name uses current surname
    await sql`
      UPDATE person_names SET surname = ${input.maidenName}, display = ${maidenDisplay}
      WHERE person_id = ${personId} AND name_type = 'birth'
    `;
    const marriedDisplay = [givenNames, input.surname].filter(Boolean).join(" ");
    await sql`
      INSERT INTO person_names (person_id, name_type, given_names, surname, display, is_primary, sort_order)
      VALUES (${personId}, 'married', ${givenNames}, ${input.surname}, ${marriedDisplay}, false, 1)
    `;
  }

  if (input.birthDate || input.birthPlace) {
    const fuzzyDate = input.birthDate
      ? { precision: "exact", date: input.birthDate, display: input.birthDate }
      : null;
    await sql`
      INSERT INTO events (person_id, event_type, date, sort_date, description, is_primary)
      VALUES (
        ${personId}, 'birth',
        ${fuzzyDate ? JSON.stringify(fuzzyDate) : null},
        ${input.birthDate ?? null},
        ${input.birthPlace ?? null},
        true
      )
    `;
  }

  if (input.deathDate) {
    const fuzzyDate = { precision: "exact", date: input.deathDate, display: input.deathDate };
    await sql`
      INSERT INTO events (person_id, event_type, date, sort_date, is_primary)
      VALUES (${personId}, 'death', ${JSON.stringify(fuzzyDate)}, ${input.deathDate}, true)
    `;
  }

  if (input.currentResidence) {
    await sql`
      INSERT INTO events (person_id, event_type, description, is_primary)
      VALUES (${personId}, 'residence', ${input.currentResidence}, false)
    `;
  }

  return personId;
}

/** create a relationship between two persons */
export async function createRelationship(input: {
  treeId: string;
  person1Id: string;
  person2Id: string;
  relationshipType: string;
}) {
  const sql = getDb();

  const result = await sql`
    INSERT INTO relationships (tree_id, person1_id, person2_id, relationship_type)
    VALUES (${input.treeId}, ${input.person1Id}, ${input.person2Id}, ${input.relationshipType})
    ON CONFLICT (person1_id, person2_id, relationship_type) DO NOTHING
    RETURNING id
  `;

  return result[0]?.id ?? null;
}

/** search persons by name */
export async function searchPersons(treeId: string, query: string) {
  const sql = getDb();
  const pattern = `%${query.toLowerCase()}%`;

  const rows = await sql`
    SELECT DISTINCT p.id, pn.display, pn.given_names, pn.surname, p.sex, p.is_living
    FROM persons p
    JOIN person_names pn ON pn.person_id = p.id
    WHERE p.tree_id = ${treeId}
      AND (LOWER(pn.given_names) LIKE ${pattern}
        OR LOWER(pn.surname) LIKE ${pattern}
        OR LOWER(pn.display) LIKE ${pattern})
    ORDER BY pn.display
    LIMIT 20
  `;

  return rows;
}

/** update person fields */
export async function updatePerson(personId: string, data: {
  givenNames?: string;
  surname?: string;
  sex?: string;
  isLiving?: boolean;
  notes?: string;
  maidenName?: string;
}) {
  const sql = getDb();

  // update person record
  if (data.sex !== undefined || data.isLiving !== undefined || data.notes !== undefined) {
    const sets: string[] = [];
    const vals: unknown[] = [];

    // build dynamic update — neon tagged template doesn't support dynamic SET
    // so we do a full update with coalesce
    await sql`
      UPDATE persons SET
        sex = COALESCE(${data.sex ?? null}, sex),
        is_living = COALESCE(${data.isLiving ?? null}, is_living),
        notes = ${data.notes !== undefined ? data.notes : null},
        updated_at = NOW()
      WHERE id = ${personId}
    `;
  }

  // update primary name if given
  if (data.givenNames !== undefined || data.surname !== undefined) {
    const display = [data.givenNames, data.surname].filter(Boolean).join(" ");
    await sql`
      UPDATE person_names SET
        given_names = COALESCE(${data.givenNames ?? null}, given_names),
        surname = COALESCE(${data.surname ?? null}, surname),
        display = ${display || null}
      WHERE person_id = ${personId} AND is_primary = true
    `;
  }

  // handle maiden name — create/update birth + married name records
  if (data.maidenName && data.surname && data.maidenName !== data.surname) {
    const givenNames = data.givenNames ?? null;

    // check if a birth name record exists
    const birthRows = await sql`
      SELECT id FROM person_names WHERE person_id = ${personId} AND name_type = 'birth'
    `;

    if (birthRows.length > 0) {
      // update existing birth name with maiden surname
      const maidenDisplay = [givenNames, data.maidenName].filter(Boolean).join(" ");
      await sql`
        UPDATE person_names SET surname = ${data.maidenName}, display = ${maidenDisplay}
        WHERE person_id = ${personId} AND name_type = 'birth'
      `;
    } else {
      // create birth name record with maiden surname
      const maidenDisplay = [givenNames, data.maidenName].filter(Boolean).join(" ");
      await sql`
        INSERT INTO person_names (person_id, name_type, given_names, surname, display, is_primary, sort_order)
        VALUES (${personId}, 'birth', ${givenNames}, ${data.maidenName}, ${maidenDisplay}, false, 0)
      `;
    }

    // check if a married name record exists
    const marriedRows = await sql`
      SELECT id FROM person_names WHERE person_id = ${personId} AND name_type = 'married'
    `;

    if (marriedRows.length === 0) {
      // create married name record with current surname
      const marriedDisplay = [givenNames, data.surname].filter(Boolean).join(" ");
      await sql`
        INSERT INTO person_names (person_id, name_type, given_names, surname, display, is_primary, sort_order)
        VALUES (${personId}, 'married', ${givenNames}, ${data.surname}, ${marriedDisplay}, false, 1)
      `;
    }
  }
}

/** add an event to a person */
export async function addEvent(personId: string, data: {
  eventType: string;
  date?: string;
  description?: string;
}) {
  const sql = getDb();
  const fuzzyDate = data.date
    ? JSON.stringify({ precision: "exact", date: data.date, display: data.date })
    : null;
  const sortDate = data.date || null;

  const result = await sql`
    INSERT INTO events (person_id, event_type, date, sort_date, description, is_primary)
    VALUES (${personId}, ${data.eventType}, ${fuzzyDate}, ${sortDate}, ${data.description ?? null}, false)
    RETURNING id
  `;
  return result[0]?.id ?? null;
}

/** delete an event */
export async function deleteEvent(eventId: string) {
  const sql = getDb();
  await sql`DELETE FROM events WHERE id = ${eventId}`;
}

/** get relatives of a person: parents, spouses, children, siblings */
export async function getPersonRelatives(personId: string, treeId: string) {
  const sql = getDb();

  // get all relationships involving this person
  const rels = await sql`
    SELECT id, person1_id, person2_id, relationship_type, start_date, end_date
    FROM relationships
    WHERE tree_id = ${treeId}
      AND (person1_id = ${personId} OR person2_id = ${personId})
  `;

  const parentRels: { personId: string; relId: string }[] = [];
  const childRels: { personId: string; relId: string }[] = [];
  const spouseRels: { personId: string; relId: string; type: string; startDate: unknown }[] = [];

  for (const rel of rels) {
    if (PARENT_TYPE_LIST.includes(rel.relationship_type)) {
      if (rel.person2_id === personId) {
        parentRels.push({ personId: rel.person1_id, relId: rel.id });
      } else {
        childRels.push({ personId: rel.person2_id, relId: rel.id });
      }
    } else if (["spouse", "partner", "ex_spouse"].includes(rel.relationship_type)) {
      const otherId = rel.person1_id === personId ? rel.person2_id : rel.person1_id;
      spouseRels.push({ personId: otherId, relId: rel.id, type: rel.relationship_type, startDate: rel.start_date });
    }
  }

  const parentIds = parentRels.map((r) => r.personId);
  const childIds = childRels.map((r) => r.personId);

  // find siblings: people who share at least one parent with this person
  let siblingIds: string[] = [];
  if (parentIds.length > 0) {
    const sibRows = await sql`
      SELECT DISTINCT r.person2_id
      FROM relationships r
      WHERE r.person1_id = ANY(${parentIds})
        AND r.relationship_type = ANY(${PARENT_TYPE_LIST})
        AND r.person2_id != ${personId}
    `;
    siblingIds = sibRows.map((r) => r.person2_id as string);
  }

  // collect all person ids we need to fetch
  const allIds = [...new Set([...parentIds, ...childIds, ...spouseRels.map((s) => s.personId), ...siblingIds])];
  if (allIds.length === 0) {
    return { parents: [], spouses: [], children: [], siblings: [] };
  }

  // fetch display info for all related persons
  const personRows = await sql`
    SELECT p.id, p.sex, p.is_living, p.thumbnail_url,
           pn.given_names, pn.surname, pn.display
    FROM persons p
    LEFT JOIN person_names pn ON pn.person_id = p.id AND pn.is_primary = true
    WHERE p.id = ANY(${allIds})
  `;

  // fetch birth/death events for lifespan display
  const eventRows = await sql`
    SELECT person_id, event_type, date
    FROM events
    WHERE person_id = ANY(${allIds})
      AND event_type IN ('birth', 'death')
  `;

  type RelativeInfo = {
    id: string;
    displayName: string;
    sex: string | null;
    isLiving: boolean;
    thumbnailUrl: string | null;
    birthDate: unknown;
    deathDate: unknown;
    relationshipId?: string;
    relationshipType?: string;
    marriageDate?: unknown;
  };

  const personMap = new Map<string, RelativeInfo>();
  for (const r of personRows) {
    const name = r.display ?? [r.given_names, r.surname].filter(Boolean).join(" ") ?? "unnamed";
    personMap.set(r.id, {
      id: r.id,
      displayName: name,
      sex: r.sex,
      isLiving: r.is_living,
      thumbnailUrl: r.thumbnail_url,
      birthDate: null,
      deathDate: null,
    });
  }

  for (const e of eventRows) {
    const info = personMap.get(e.person_id);
    if (!info) continue;
    if (e.event_type === "birth") info.birthDate = e.date;
    if (e.event_type === "death") info.deathDate = e.date;
  }

  return {
    parents: parentRels.map((r) => {
      const info = personMap.get(r.personId);
      return info ? { ...info, relationshipId: r.relId } : null;
    }).filter(Boolean) as RelativeInfo[],
    spouses: spouseRels.map((s) => {
      const info = personMap.get(s.personId);
      if (!info) return null;
      return { ...info, relationshipId: s.relId, relationshipType: s.type, marriageDate: s.startDate };
    }).filter(Boolean) as RelativeInfo[],
    children: childRels.map((r) => {
      const info = personMap.get(r.personId);
      return info ? { ...info, relationshipId: r.relId } : null;
    }).filter(Boolean) as RelativeInfo[],
    siblings: siblingIds.map((id) => personMap.get(id)).filter(Boolean) as RelativeInfo[],
  };
}

/** update a person's thumbnail if they don't already have one */
export async function updatePersonThumbnail(personId: string, url: string) {
  const sql = getDb();
  await sql`UPDATE persons SET thumbnail_url = ${url}, updated_at = now() WHERE id = ${personId} AND thumbnail_url IS NULL`;
}

/** get all places with coordinates for a tree */
export async function getTreePlaces(treeId: string): Promise<Place[]> {
  const sql = getDb();
  const rows = await sql`
    SELECT p.id, p.tree_id, p.parent_id, p.place_type,
           p.latitude, p.longitude,
           COALESCE(pn.name, 'unnamed place') as name
    FROM places p
    LEFT JOIN place_names pn ON pn.place_id = p.id AND pn.is_current = true
    WHERE p.tree_id = ${treeId}
      AND p.latitude IS NOT NULL
      AND p.longitude IS NOT NULL
  `;
  return rows as Place[];
}

/** get a single person with all details */
export async function getPerson(personId: string): Promise<Person | null> {
  const sql = getDb();

  const rows = await sql`
    SELECT id, tree_id, sex, is_living, privacy_level,
           thumbnail_url, notes, created_at, updated_at
    FROM persons WHERE id = ${personId}
  `;
  if (rows.length === 0) return null;

  const person = rows[0];

  const names = await sql`
    SELECT id, person_id, name_type, given_names, surname,
           prefix, suffix, display, is_primary, sort_order
    FROM person_names WHERE person_id = ${personId}
    ORDER BY sort_order
  `;

  const events = await sql`
    SELECT id, person_id, event_type, date, sort_date,
           place_id, description, is_primary
    FROM events WHERE person_id = ${personId}
    ORDER BY sort_date NULLS LAST
  `;

  return {
    ...person,
    names: names as PersonName[],
    events: events as PersonEvent[],
  } as Person;
}

/** get all sources linked to a person's events via citations */
export async function getPersonSources(personId: string) {
  const sql = getDb();

  const rows = await sql`
    SELECT
      s.id AS source_id,
      s.title,
      s.author,
      s.source_type,
      s.url,
      c.id AS citation_id,
      c.page,
      c.confidence,
      c.extract,
      c.notes AS citation_notes,
      e.event_type,
      e.id AS event_id
    FROM citations c
    JOIN sources s ON s.id = c.source_id
    LEFT JOIN events e ON e.id = c.event_id
    WHERE e.person_id = ${personId}
    ORDER BY s.title, e.sort_date NULLS LAST
  `;

  return rows;
}

/** create a source record */
export async function createSource(treeId: string, data: {
  title: string;
  author?: string | null;
  publisher?: string | null;
  sourceType?: string | null;
  url?: string | null;
  notes?: string | null;
}) {
  const sql = getDb();

  const result = await sql`
    INSERT INTO sources (tree_id, title, author, publisher, source_type, url, notes)
    VALUES (
      ${treeId},
      ${data.title},
      ${data.author ?? null},
      ${data.publisher ?? null},
      ${data.sourceType ?? null},
      ${data.url ?? null},
      ${data.notes ?? null}
    )
    RETURNING id
  `;

  return result[0]?.id ?? null;
}

/** create a citation linking a source to an event */
export async function createCitation(data: {
  sourceId: string;
  eventId?: string | null;
  page?: string | null;
  confidence?: string | null;
  extract?: string | null;
  notes?: string | null;
}) {
  const sql = getDb();

  const result = await sql`
    INSERT INTO citations (source_id, event_id, page, confidence, extract, notes)
    VALUES (
      ${data.sourceId},
      ${data.eventId ?? null},
      ${data.page ?? null},
      ${data.confidence ?? null},
      ${data.extract ?? null},
      ${data.notes ?? null}
    )
    RETURNING id
  `;

  return result[0]?.id ?? null;
}

/** list all sources for a tree with citation counts */
export async function getTreeSources(treeId: string) {
  const sql = getDb();

  const rows = await sql`
    SELECT
      s.id, s.tree_id, s.title, s.author, s.publisher,
      s.source_type, s.url, s.notes, s.created_at,
      COUNT(c.id)::int AS citation_count
    FROM sources s
    LEFT JOIN citations c ON c.source_id = s.id
    WHERE s.tree_id = ${treeId}
    GROUP BY s.id
    ORDER BY s.title
  `;

  return rows;
}

/** get a single source with all its citations */
export async function getSourceWithCitations(sourceId: string) {
  const sql = getDb();

  const sourceRows = await sql`
    SELECT id, tree_id, title, author, publisher, source_type, url, notes, created_at
    FROM sources WHERE id = ${sourceId}
  `;
  if (sourceRows.length === 0) return null;

  const citations = await sql`
    SELECT
      c.id, c.source_id, c.event_id, c.page, c.confidence, c.extract, c.notes,
      e.event_type,
      pn.display AS person_name,
      p.id AS person_id
    FROM citations c
    LEFT JOIN events e ON e.id = c.event_id
    LEFT JOIN persons p ON p.id = e.person_id
    LEFT JOIN person_names pn ON pn.person_id = p.id AND pn.is_primary = true
    WHERE c.source_id = ${sourceId}
    ORDER BY pn.display, e.event_type
  `;

  return { source: sourceRows[0], citations };
}

/** delete a source and its citations (cascade) */
export async function deleteSource(sourceId: string) {
  const sql = getDb();
  await sql`DELETE FROM sources WHERE id = ${sourceId}`;
}

/** delete a single citation */
export async function deleteCitation(citationId: string) {
  const sql = getDb();
  await sql`DELETE FROM citations WHERE id = ${citationId}`;
}

/** delete a person — CASCADE handles names, events, relationships, hints, media_links */
export async function deletePerson(personId: string) {
  const sql = getDb();
  await sql`DELETE FROM persons WHERE id = ${personId}`;
}

/** delete a single relationship */
export async function deleteRelationship(relationshipId: string) {
  const sql = getDb();
  await sql`DELETE FROM relationships WHERE id = ${relationshipId}`;
}

// --- tree sharing ---

/** list all members of a tree */
export async function getTreeMembers(treeId: string): Promise<TreeMember[]> {
  const sql = getDb();
  const rows = await sql`
    SELECT tree_id, member_email, role, created_at
    FROM tree_members
    WHERE tree_id = ${treeId}
    ORDER BY created_at
  `;
  return rows as TreeMember[];
}

/** invite a member to a tree (upsert by email) */
export async function addTreeMember(treeId: string, email: string, role: TreeRole) {
  const sql = getDb();
  const result = await sql`
    INSERT INTO tree_members (tree_id, member_email, role)
    VALUES (${treeId}, ${email}, ${role})
    ON CONFLICT (tree_id, member_email)
    DO UPDATE SET role = ${role}
    RETURNING id
  `;
  return result[0]?.id ?? null;
}

/** remove a member from a tree */
export async function removeTreeMember(treeId: string, email: string) {
  const sql = getDb();
  await sql`
    DELETE FROM tree_members
    WHERE tree_id = ${treeId} AND member_email = ${email}
  `;
}

/** change a member's role */
export async function updateTreeMemberRole(treeId: string, email: string, role: TreeRole) {
  const sql = getDb();
  await sql`
    UPDATE tree_members SET role = ${role}
    WHERE tree_id = ${treeId} AND member_email = ${email}
  `;
}

/** get all trees a user can access (owned + member of) */
export async function getAccessibleTrees(email: string) {
  const sql = getDb();
  const rows = await sql`
    SELECT t.id, t.name, t.description, t.owner_email, t.visibility, t.created_at,
           COALESCE(tm.role, 'owner') AS role
    FROM trees t
    LEFT JOIN tree_members tm ON tm.tree_id = t.id AND tm.member_email = ${email}
    WHERE t.owner_email = ${email} OR tm.member_email = ${email}
    ORDER BY t.created_at
  `;
  return rows;
}

/** check if a user has access to a tree (owner or member) */
export async function canAccessTree(treeId: string, email: string): Promise<boolean> {
  const sql = getDb();
  const rows = await sql`
    SELECT 1 FROM trees WHERE id = ${treeId} AND owner_email = ${email}
    UNION ALL
    SELECT 1 FROM tree_members WHERE tree_id = ${treeId} AND member_email = ${email}
    LIMIT 1
  `;
  return rows.length > 0;
}

/** get a user's role for a tree: 'owner' | 'editor' | 'viewer' | null */
export async function getTreeRole(treeId: string, email: string): Promise<TreeRole | null> {
  const sql = getDb();

  // check if owner first
  const ownerCheck = await sql`
    SELECT 1 FROM trees WHERE id = ${treeId} AND owner_email = ${email}
  `;
  if (ownerCheck.length > 0) return "owner";

  // check membership
  const memberCheck = await sql`
    SELECT role FROM tree_members
    WHERE tree_id = ${treeId} AND member_email = ${email}
  `;
  if (memberCheck.length > 0) return memberCheck[0].role as TreeRole;

  return null;
}

/** update tree visibility */
export async function updateTreeVisibility(treeId: string, visibility: string) {
  const sql = getDb();
  await sql`
    UPDATE trees SET visibility = ${visibility}, updated_at = now()
    WHERE id = ${treeId}
  `;
}

// ---------------------------------------------------------------------------
// activity log
// ---------------------------------------------------------------------------

export type ActivityEntry = {
  id: string;
  tree_id: string;
  actor_email: string;
  action: string;
  target_type: string | null;
  target_id: string | null;
  target_name: string | null;
  details: Record<string, unknown> | null;
  created_at: string;
};

/** log an activity to the feed */
export async function logActivity(input: {
  treeId: string;
  actorEmail: string;
  action: string;
  targetType?: string;
  targetId?: string;
  targetName?: string;
  details?: Record<string, unknown>;
}) {
  const sql = getDb();
  try {
    await sql`
      INSERT INTO activity_log (tree_id, actor_email, action, target_type, target_id, target_name, details)
      VALUES (
        ${input.treeId},
        ${input.actorEmail},
        ${input.action},
        ${input.targetType ?? null},
        ${input.targetId ?? null},
        ${input.targetName ?? null},
        ${input.details ? JSON.stringify(input.details) : null}
      )
    `;
  } catch {
    // activity logging is non-critical — don't break mutations if the table doesn't exist yet
    console.warn("activity_log: failed to write (table may not exist yet)");
  }
}

/** get recent activity for a tree */
export async function getRecentActivity(treeId: string, limit = 20): Promise<ActivityEntry[]> {
  const sql = getDb();
  try {
    const rows = await sql`
      SELECT id, tree_id, actor_email, action, target_type, target_id,
             target_name, details, created_at
      FROM activity_log
      WHERE tree_id = ${treeId}
      ORDER BY created_at DESC
      LIMIT ${limit}
    `;
    return rows as ActivityEntry[];
  } catch {
    // table may not exist yet
    return [];
  }
}

// ---------------------------------------------------------------------------
// hints — suggested matches from external databases
// ---------------------------------------------------------------------------

/** get all hints for a tree, optionally filtered by status */
export async function getHintsForTree(
  treeId: string,
  status?: HintStatus,
  limit?: number,
): Promise<Hint[]> {
  const sql = getDb();
  try {
    if (status) {
      const rows = await sql`
        SELECT * FROM hints
        WHERE tree_id = ${treeId} AND status = ${status}
        ORDER BY confidence DESC, created_at DESC
        LIMIT ${limit ?? 100}
      `;
      return rows as Hint[];
    }
    const rows = await sql`
      SELECT * FROM hints
      WHERE tree_id = ${treeId}
      ORDER BY confidence DESC, created_at DESC
      LIMIT ${limit ?? 100}
    `;
    return rows as Hint[];
  } catch {
    // hints table may not exist yet
    return [];
  }
}

/** get hints for a specific person, optionally filtered by status */
export async function getHintsForPerson(
  personId: string,
  status?: HintStatus,
): Promise<Hint[]> {
  const sql = getDb();
  try {
    if (status) {
      const rows = await sql`
        SELECT * FROM hints
        WHERE person_id = ${personId} AND status = ${status}
        ORDER BY confidence DESC, created_at DESC
      `;
      return rows as Hint[];
    }
    const rows = await sql`
      SELECT * FROM hints
      WHERE person_id = ${personId}
      ORDER BY confidence DESC, created_at DESC
    `;
    return rows as Hint[];
  } catch {
    return [];
  }
}

/** insert or update a hint (upsert on person_id + source_system + external_id) */
export async function upsertHint(data: {
  treeId: string;
  personId: string;
  sourceSystem: string;
  externalId: string;
  matchData: unknown;
  confidence: number;
  evidence: unknown;
}): Promise<string | null> {
  const sql = getDb();
  try {
    const result = await sql`
      INSERT INTO hints (tree_id, person_id, source_system, external_id, match_data, confidence, evidence)
      VALUES (
        ${data.treeId},
        ${data.personId},
        ${data.sourceSystem},
        ${data.externalId},
        ${JSON.stringify(data.matchData)},
        ${data.confidence},
        ${JSON.stringify(data.evidence)}
      )
      ON CONFLICT (person_id, source_system, external_id)
      DO UPDATE SET
        match_data = EXCLUDED.match_data,
        confidence = EXCLUDED.confidence,
        evidence = EXCLUDED.evidence
      RETURNING id
    `;
    return result[0]?.id ?? null;
  } catch {
    return null;
  }
}

/** update a hint's status (accept/reject/expire) */
export async function updateHintStatus(
  hintId: string,
  status: HintStatus,
): Promise<void> {
  const sql = getDb();
  await sql`
    UPDATE hints SET status = ${status}, reviewed_at = NOW()
    WHERE id = ${hintId}
  `;
}

/** get counts of hints by status for a tree */
export async function getHintCounts(
  treeId: string,
): Promise<{ pending: number; accepted: number; rejected: number; expired: number }> {
  const sql = getDb();
  try {
    const rows = await sql`
      SELECT status, COUNT(*)::int AS count
      FROM hints
      WHERE tree_id = ${treeId}
      GROUP BY status
    `;
    const counts = { pending: 0, accepted: 0, rejected: 0, expired: 0 };
    for (const row of rows) {
      if (row.status in counts) {
        (counts as Record<string, number>)[row.status as string] = row.count;
      }
    }
    return counts;
  } catch {
    return { pending: 0, accepted: 0, rejected: 0, expired: 0 };
  }
}

// ---------------------------------------------------------------------------
// research tasks
// ---------------------------------------------------------------------------

/** get all tasks for a tree, joined with person display name */
export async function getTreeTasks(treeId: string): Promise<ResearchTask[]> {
  const sql = getDb();
  try {
    const rows = await sql`
      SELECT
        t.id, t.tree_id, t.person_id, t.title, t.description,
        t.status, t.priority, t.source, t.hint_id, t.due_date,
        t.created_at, t.updated_at,
        pn.display AS person_name
      FROM research_tasks t
      LEFT JOIN person_names pn ON pn.person_id = t.person_id AND pn.is_primary = true
      WHERE t.tree_id = ${treeId}
      ORDER BY
        CASE t.priority WHEN 'high' THEN 0 WHEN 'medium' THEN 1 WHEN 'low' THEN 2 END,
        t.created_at DESC
    `;
    return rows as ResearchTask[];
  } catch {
    return [];
  }
}

/** create a research task */
export async function createTask(treeId: string, data: {
  title: string;
  description?: string | null;
  personId?: string | null;
  priority?: TaskPriority;
  source?: string | null;
  hintId?: string | null;
  dueDate?: string | null;
}): Promise<string | null> {
  const sql = getDb();
  try {
    const result = await sql`
      INSERT INTO research_tasks (tree_id, person_id, title, description, priority, source, hint_id, due_date)
      VALUES (
        ${treeId},
        ${data.personId ?? null},
        ${data.title},
        ${data.description ?? null},
        ${data.priority ?? "medium"},
        ${data.source ?? "manual"},
        ${data.hintId ?? null},
        ${data.dueDate ?? null}
      )
      RETURNING id
    `;
    return result[0]?.id ?? null;
  } catch {
    return null;
  }
}

/** update a task's status */
export async function updateTaskStatus(taskId: string, status: TaskStatus): Promise<void> {
  const sql = getDb();
  await sql`
    UPDATE research_tasks SET status = ${status}, updated_at = now()
    WHERE id = ${taskId}
  `;
}

/** update task fields */
export async function updateTask(taskId: string, data: {
  title?: string;
  description?: string | null;
  personId?: string | null;
  priority?: TaskPriority;
  dueDate?: string | null;
}): Promise<void> {
  const sql = getDb();
  await sql`
    UPDATE research_tasks SET
      title = COALESCE(${data.title ?? null}, title),
      description = COALESCE(${data.description ?? null}, description),
      person_id = COALESCE(${data.personId ?? null}, person_id),
      priority = COALESCE(${data.priority ?? null}, priority),
      due_date = COALESCE(${data.dueDate ?? null}, due_date),
      updated_at = now()
    WHERE id = ${taskId}
  `;
}

/** delete a task */
export async function deleteTask(taskId: string): Promise<void> {
  const sql = getDb();
  await sql`DELETE FROM research_tasks WHERE id = ${taskId}`;
}

/** analyze persons for data gaps and auto-create research tasks */
export async function generateTasksFromGaps(treeId: string, persons: Person[]): Promise<number> {
  const sql = getDb();
  let created = 0;

  for (const person of persons) {
    const displayName =
      person.names.find((n) => n.is_primary)?.display ??
      [person.names[0]?.given_names, person.names[0]?.surname].filter(Boolean).join(" ") ??
      "unnamed";

    const hasBirth = person.events.some((e) => e.event_type === "birth" && e.date);
    const hasDeath = person.events.some((e) => e.event_type === "death" && e.date);

    // check for existing parents
    const parentRows = await sql`
      SELECT 1 FROM relationships
      WHERE person2_id = ${person.id}
        AND relationship_type = ANY(${PARENT_TYPE_LIST})
      LIMIT 1
    `;
    const hasParents = parentRows.length > 0;

    const gaps: { title: string; description: string; priority: TaskPriority }[] = [];

    if (!hasBirth) {
      gaps.push({
        title: `find birth date for ${displayName}`,
        description: `no birth date recorded. check vital records, census data, or family bibles.`,
        priority: "high",
      });
    }

    if (!person.is_living && !hasDeath) {
      gaps.push({
        title: `find death date for ${displayName}`,
        description: `marked as deceased but no death date recorded. check obituaries, cemetery records, or vital records.`,
        priority: "medium",
      });
    }

    if (!hasParents) {
      gaps.push({
        title: `identify parents of ${displayName}`,
        description: `no parents linked. search census records, birth certificates, or church records.`,
        priority: "high",
      });
    }

    for (const gap of gaps) {
      // avoid duplicates: check if a similar auto_gap task already exists
      const existing = await sql`
        SELECT 1 FROM research_tasks
        WHERE tree_id = ${treeId}
          AND person_id = ${person.id}
          AND source = 'auto_gap'
          AND title = ${gap.title}
          AND status != 'done'
        LIMIT 1
      `;
      if (existing.length > 0) continue;

      await sql`
        INSERT INTO research_tasks (tree_id, person_id, title, description, priority, source)
        VALUES (${treeId}, ${person.id}, ${gap.title}, ${gap.description}, ${gap.priority}, 'auto_gap')
      `;
      created++;
    }
  }

  return created;
}

// ---------------------------------------------------------------------------
// merge persons
// ---------------------------------------------------------------------------

/** merge personB into personA: move all names, events, relationships, then delete personB */
export async function mergePersons(
  keepId: string,
  removeId: string,
): Promise<void> {
  const sql = getDb();

  // move non-duplicate names from removeId to keepId
  const existingNames = await sql`
    SELECT LOWER(given_names) as given, LOWER(surname) as surname FROM person_names WHERE person_id = ${keepId}
  `;
  const nameSet = new Set(existingNames.map((n) => `${n.given}|${n.surname}`));

  const removeNames = await sql`
    SELECT id, given_names, surname FROM person_names WHERE person_id = ${removeId}
  `;
  for (const n of removeNames) {
    const key = `${(n.given_names ?? "").toLowerCase()}|${(n.surname ?? "").toLowerCase()}`;
    if (!nameSet.has(key)) {
      await sql`UPDATE person_names SET person_id = ${keepId}, is_primary = false WHERE id = ${n.id}`;
    }
  }

  // move events that don't duplicate existing event types+dates
  const existingEvents = await sql`
    SELECT event_type, sort_date FROM events WHERE person_id = ${keepId}
  `;
  const eventSet = new Set(existingEvents.map((e) => `${e.event_type}|${e.sort_date ?? ""}`));

  const removeEvents = await sql`
    SELECT id, event_type, sort_date FROM events WHERE person_id = ${removeId}
  `;
  for (const e of removeEvents) {
    const key = `${e.event_type}|${e.sort_date ?? ""}`;
    if (!eventSet.has(key)) {
      await sql`UPDATE events SET person_id = ${keepId} WHERE id = ${e.id}`;
    }
  }

  // move relationships — remap person references, skip duplicates
  const existingRels = await sql`
    SELECT person1_id, person2_id, relationship_type FROM relationships
    WHERE person1_id = ${keepId} OR person2_id = ${keepId}
  `;
  const relSet = new Set(existingRels.map((r) =>
    `${r.person1_id}|${r.person2_id}|${r.relationship_type}`
  ));

  const rels1 = await sql`
    SELECT id, person1_id, person2_id, relationship_type FROM relationships
    WHERE person1_id = ${removeId}
  `;
  for (const r of rels1) {
    if (r.person2_id === keepId) {
      await sql`DELETE FROM relationships WHERE id = ${r.id}`;
    } else {
      const key = `${keepId}|${r.person2_id}|${r.relationship_type}`;
      if (!relSet.has(key)) {
        await sql`UPDATE relationships SET person1_id = ${keepId} WHERE id = ${r.id}`;
        relSet.add(key);
      } else {
        await sql`DELETE FROM relationships WHERE id = ${r.id}`;
      }
    }
  }

  const rels2 = await sql`
    SELECT id, person1_id, person2_id, relationship_type FROM relationships
    WHERE person2_id = ${removeId}
  `;
  for (const r of rels2) {
    if (r.person1_id === keepId) {
      await sql`DELETE FROM relationships WHERE id = ${r.id}`;
    } else {
      const key = `${r.person1_id}|${keepId}|${r.relationship_type}`;
      if (!relSet.has(key)) {
        await sql`UPDATE relationships SET person2_id = ${keepId} WHERE id = ${r.id}`;
        relSet.add(key);
      } else {
        await sql`DELETE FROM relationships WHERE id = ${r.id}`;
      }
    }
  }

  // move media links
  await sql`UPDATE media_links SET person_id = ${keepId} WHERE person_id = ${removeId}`;

  // move hints
  try {
    await sql`UPDATE hints SET person_id = ${keepId} WHERE person_id = ${removeId}`;
  } catch { /* hints table may not exist */ }

  // merge notes
  const [keepPerson] = await sql`SELECT notes, thumbnail_url FROM persons WHERE id = ${keepId}`;
  const [removePerson] = await sql`SELECT notes FROM persons WHERE id = ${removeId}`;
  if (removePerson?.notes && removePerson.notes !== keepPerson?.notes) {
    const merged = [keepPerson?.notes, removePerson.notes].filter(Boolean).join("\n\n");
    await sql`UPDATE persons SET notes = ${merged} WHERE id = ${keepId}`;
  }

  // copy thumbnail if keep doesn't have one
  if (!keepPerson?.thumbnail_url) {
    await sql`
      UPDATE persons SET thumbnail_url = (SELECT thumbnail_url FROM persons WHERE id = ${removeId})
      WHERE id = ${keepId} AND thumbnail_url IS NULL
    `;
  }

  // delete the removed person (cascades names, events via FK)
  await sql`DELETE FROM persons WHERE id = ${removeId}`;
  await sql`UPDATE persons SET updated_at = NOW() WHERE id = ${keepId}`;
}
