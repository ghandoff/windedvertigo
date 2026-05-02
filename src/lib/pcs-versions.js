/**
 * PCS Versions CRUD — version snapshots of PCS documents.
 *
 * Each version belongs to a document and contains claims, formula lines,
 * references, and revision events.
 */

import { PCS_DB, PROPS } from './pcs-config.js';
import { notion } from './notion.js';


const P = PROPS.versions;

function parsePage(page) {
  const p = page.properties;
  return {
    id: page.id,
    version: p[P.version]?.title?.[0]?.plain_text || '',
    pcsDocumentId: (p[P.pcsDocument]?.relation || [])[0]?.id || null,
    effectiveDate: p[P.effectiveDate]?.date?.start || null,
    isLatest: p[P.isLatest]?.checkbox || false,
    versionNotes: (p[P.versionNotes]?.rich_text || []).map(t => t.plain_text).join(''),
    supersedesId: (p[P.supersedes]?.relation || [])[0]?.id || null,
    claimIds: (p[P.claims]?.relation || []).map(r => r.id),
    formulaLineIds: (p[P.formulaLines]?.relation || []).map(r => r.id),
    referenceIds: (p[P.references]?.relation || []).map(r => r.id),
    revisionEventIds: (p[P.revisionEvents]?.relation || []).map(r => r.id),
    requestIds: (p[P.requests]?.relation || []).map(r => r.id),
    latestVersionOfId: (p[P.latestVersionOf]?.relation || [])[0]?.id || null,
    // Lauren's template Table 1 + Table 2 footer — added 2026-04-18
    productName: (p[P.productName]?.rich_text || []).map(t => t.plain_text).join(''),
    formatOverride: (p[P.formatOverride]?.rich_text || []).map(t => t.plain_text).join(''),
    demographic: (p[P.demographic]?.multi_select || []).map(s => s.name),
    // Demographic axes (Wave 4.1a) — four orthogonal dimensions
    biologicalSex: (p[P.biologicalSex]?.multi_select || []).map(s => s.name),
    ageGroup: (p[P.ageGroup]?.multi_select || []).map(s => s.name),
    lifeStage: (p[P.lifeStage]?.multi_select || []).map(s => s.name),
    lifestyle: (p[P.lifestyle]?.multi_select || []).map(s => s.name),
    demographicBackfillReview: (p[P.demographicBackfillReview]?.rich_text || []).map(t => t.plain_text).join(''),
    dailyServingSize: (p[P.dailyServingSize]?.rich_text || []).map(t => t.plain_text).join(''),
    totalEPA: p[P.totalEPA]?.number ?? null,
    totalDHA: p[P.totalDHA]?.number ?? null,
    totalEPAandDHA: p[P.totalEPAandDHA]?.number ?? null,
    totalOmega6: p[P.totalOmega6]?.number ?? null,
    totalOmega9: p[P.totalOmega9]?.number ?? null,
    createdTime: page.created_time,
    lastEditedTime: page.last_edited_time,
  };
}

/**
 * Build the Notion properties payload for Lauren's template fields.
 * Extracted so both createVersion and updateVersion can share it.
 */
function laurenTemplateProps(fields) {
  const out = {};
  if (fields.productName !== undefined) {
    out[P.productName] = { rich_text: [{ text: { content: fields.productName || '' } }] };
  }
  if (fields.formatOverride !== undefined) {
    out[P.formatOverride] = { rich_text: [{ text: { content: fields.formatOverride || '' } }] };
  }
  if (fields.demographic !== undefined) {
    out[P.demographic] = { multi_select: (fields.demographic || []).map(name => ({ name })) };
  }
  // Demographic axes (Wave 4.1a)
  if (fields.biologicalSex !== undefined) {
    out[P.biologicalSex] = { multi_select: (fields.biologicalSex || []).map(name => ({ name })) };
  }
  if (fields.ageGroup !== undefined) {
    out[P.ageGroup] = { multi_select: (fields.ageGroup || []).map(name => ({ name })) };
  }
  if (fields.lifeStage !== undefined) {
    out[P.lifeStage] = { multi_select: (fields.lifeStage || []).map(name => ({ name })) };
  }
  if (fields.lifestyle !== undefined) {
    out[P.lifestyle] = { multi_select: (fields.lifestyle || []).map(name => ({ name })) };
  }
  if (fields.demographicBackfillReview !== undefined) {
    out[P.demographicBackfillReview] = {
      rich_text: [{ text: { content: fields.demographicBackfillReview || '' } }],
    };
  }
  if (fields.dailyServingSize !== undefined) {
    out[P.dailyServingSize] = { rich_text: [{ text: { content: fields.dailyServingSize || '' } }] };
  }
  if (fields.totalEPA !== undefined) out[P.totalEPA] = { number: fields.totalEPA };
  if (fields.totalDHA !== undefined) out[P.totalDHA] = { number: fields.totalDHA };
  if (fields.totalEPAandDHA !== undefined) out[P.totalEPAandDHA] = { number: fields.totalEPAandDHA };
  if (fields.totalOmega6 !== undefined) out[P.totalOmega6] = { number: fields.totalOmega6 };
  if (fields.totalOmega9 !== undefined) out[P.totalOmega9] = { number: fields.totalOmega9 };
  return out;
}

export async function getVersionsForDocument(documentId) {
  const res = await notion.databases.query({
    database_id: PCS_DB.versions,
    filter: { property: P.pcsDocument, relation: { contains: documentId } },
    sorts: [{ property: P.effectiveDate, direction: 'descending' }],
  });
  return res.results.map(parsePage);
}

export async function getVersion(id) {
  const page = await notion.pages.retrieve({ page_id: id });
  return parsePage(page);
}

export async function getAllVersions() {
  let all = [];
  let cursor = undefined;
  do {
    const res = await notion.databases.query({
      database_id: PCS_DB.versions,
      start_cursor: cursor,
      sorts: [{ property: P.effectiveDate, direction: 'descending' }],
    });
    all = all.concat(res.results);
    cursor = res.has_more ? res.next_cursor : undefined;
  } while (cursor);
  return all.map(parsePage);
}

export async function createVersion(fields) {
  const properties = {
    [P.version]: { title: [{ text: { content: fields.version } }] },
  };
  if (fields.pcsDocumentId) {
    properties[P.pcsDocument] = { relation: [{ id: fields.pcsDocumentId }] };
  }
  if (fields.effectiveDate) {
    properties[P.effectiveDate] = { date: { start: fields.effectiveDate } };
  }
  if (fields.isLatest !== undefined) {
    properties[P.isLatest] = { checkbox: fields.isLatest };
  }
  if (fields.versionNotes) {
    properties[P.versionNotes] = { rich_text: [{ text: { content: fields.versionNotes } }] };
  }
  if (fields.supersedesId) {
    properties[P.supersedes] = { relation: [{ id: fields.supersedesId }] };
  }
  Object.assign(properties, laurenTemplateProps(fields));

  const page = await notion.pages.create({
    parent: { database_id: PCS_DB.versions },
    properties,
  });
  const parsed = parsePage(page);

  // When creating a version marked isLatest=true, also repoint the parent
  // document's `latestVersion` relation so drift detection (label-drift.js)
  // and the Living PCS view read the fresh version. Non-fatal on failure.
  if (fields.isLatest === true && fields.pcsDocumentId) {
    try {
      const { setLatestVersion } = await import('./pcs-documents.js');
      await setLatestVersion(fields.pcsDocumentId, parsed.id);
    } catch (err) {
      console.warn('[pcs-versions] createVersion: setLatestVersion failed', err);
    }
  }

  return parsed;
}

export async function updateVersion(id, fields) {
  const properties = {};
  if (fields.version !== undefined) {
    properties[P.version] = { title: [{ text: { content: fields.version } }] };
  }
  if (fields.effectiveDate !== undefined) {
    properties[P.effectiveDate] = fields.effectiveDate
      ? { date: { start: fields.effectiveDate } }
      : { date: null };
  }
  if (fields.isLatest !== undefined) {
    properties[P.isLatest] = { checkbox: fields.isLatest };
  }
  if (fields.versionNotes !== undefined) {
    properties[P.versionNotes] = { rich_text: [{ text: { content: fields.versionNotes } }] };
  }
  Object.assign(properties, laurenTemplateProps(fields));
  const page = await notion.pages.update({ page_id: id, properties });
  return parsePage(page);
}
