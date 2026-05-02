/**
 * PCS References CRUD — junction table linking PCS Versions to Evidence items.
 *
 * Each reference maps a PCS-local citation label (e.g., "[12]") to a
 * canonical evidence library entry, with the original bibliography text.
 */

import { PCS_DB, PROPS } from './pcs-config.js';
import { notion } from './notion.js';


const P = PROPS.references;

function parsePage(page) {
  const p = page.properties;
  return {
    id: page.id,
    name: p[P.name]?.title?.[0]?.plain_text || '',
    pcsReferenceLabel: (p[P.pcsReferenceLabel]?.rich_text || []).map(t => t.plain_text).join(''),
    referenceTextAsWritten: (p[P.referenceTextAsWritten]?.rich_text || []).map(t => t.plain_text).join(''),
    referenceNotes: (p[P.referenceNotes]?.rich_text || []).map(t => t.plain_text).join(''),
    pcsVersionId: (p[P.pcsVersion]?.relation || [])[0]?.id || null,
    evidenceItemId: (p[P.evidenceItem]?.relation || [])[0]?.id || null,
    createdTime: page.created_time,
    lastEditedTime: page.last_edited_time,
  };
}

export async function getReferencesForVersion(versionId) {
  const res = await notion.databases.query({
    database_id: PCS_DB.references,
    filter: { property: P.pcsVersion, relation: { contains: versionId } },
  });
  return res.results.map(parsePage);
}

export async function getAllReferences() {
  let all = [];
  let cursor = undefined;
  do {
    const res = await notion.databases.query({
      database_id: PCS_DB.references,
      start_cursor: cursor,
    });
    all = all.concat(res.results);
    cursor = res.has_more ? res.next_cursor : undefined;
  } while (cursor);
  return all.map(parsePage);
}

export async function getReference(id) {
  const page = await notion.pages.retrieve({ page_id: id });
  return parsePage(page);
}

export async function getUnlinkedReferences() {
  const res = await notion.databases.query({
    database_id: PCS_DB.references,
    filter: { property: P.evidenceItem, relation: { is_empty: true } },
  });
  return res.results.map(parsePage);
}

export async function createReference(fields) {
  const properties = {
    [P.name]: { title: [{ text: { content: fields.name || '' } }] },
  };
  if (fields.pcsReferenceLabel) {
    properties[P.pcsReferenceLabel] = { rich_text: [{ text: { content: fields.pcsReferenceLabel } }] };
  }
  if (fields.referenceTextAsWritten) {
    properties[P.referenceTextAsWritten] = { rich_text: [{ text: { content: fields.referenceTextAsWritten } }] };
  }
  if (fields.referenceNotes) {
    properties[P.referenceNotes] = { rich_text: [{ text: { content: fields.referenceNotes } }] };
  }
  if (fields.pcsVersionId) {
    properties[P.pcsVersion] = { relation: [{ id: fields.pcsVersionId }] };
  }
  if (fields.evidenceItemId) {
    properties[P.evidenceItem] = { relation: [{ id: fields.evidenceItemId }] };
  }
  const page = await notion.pages.create({
    parent: { database_id: PCS_DB.references },
    properties,
  });
  return parsePage(page);
}

export async function updateReference(id, fields) {
  const properties = {};
  if (fields.name !== undefined) {
    properties[P.name] = { title: [{ text: { content: fields.name } }] };
  }
  if (fields.pcsReferenceLabel !== undefined) {
    properties[P.pcsReferenceLabel] = { rich_text: [{ text: { content: fields.pcsReferenceLabel } }] };
  }
  if (fields.referenceTextAsWritten !== undefined) {
    properties[P.referenceTextAsWritten] = { rich_text: [{ text: { content: fields.referenceTextAsWritten } }] };
  }
  if (fields.referenceNotes !== undefined) {
    properties[P.referenceNotes] = { rich_text: [{ text: { content: fields.referenceNotes } }] };
  }
  if (fields.evidenceItemId !== undefined) {
    properties[P.evidenceItem] = fields.evidenceItemId
      ? { relation: [{ id: fields.evidenceItemId }] }
      : { relation: [] };
  }
  const page = await notion.pages.update({ page_id: id, properties });
  return parsePage(page);
}
