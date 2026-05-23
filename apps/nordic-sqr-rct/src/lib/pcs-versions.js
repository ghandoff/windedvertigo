/**
 * PCS Versions CRUD — version snapshots of PCS documents.
 *
 * Each version belongs to a document and contains claims, formula lines,
 * references, and revision events.
 */

import { PCS_DB, PROPS } from './pcs-config.js';
import { notion } from './notion.js';
import { getPcsSupabase, shouldReadFromPostgres, mirrorToPostgres, shouldUseStrongConsistency, shouldWriteToPostgresFirst, writePostgresFirst } from './supabase-pcs.js';

// 2026-05-06 — Path-2 Day 2.7 column-name overrides for versions.
// Notion shape uses uppercase abbreviations (EPA, DHA) that the default
// camelCase → snake_case regex would otherwise mangle (totalEPA →
// total_e_p_a). Map these to the actual Postgres column names.
const VERSIONS_PG_COLUMN_MAP = {
  totalEPA: 'total_epa',
  totalDHA: 'total_dha',
  totalEPAandDHA: 'total_epa_and_dha',
};

const P = PROPS.versions;

/**
 * 2026-05-06 — Path-2 Day 2.7. Convert a Postgres pcs_versions row
 * into the same shape parsePage() returns. See pcs-evidence.js for
 * the full pattern rationale.
 */
function parsePostgresRow(row) {
  return {
    id: row.notion_page_id,
    version: row.version || '',
    pcsDocumentId: row.pcs_document_id || null,
    effectiveDate: row.effective_date || null,
    isLatest: row.is_latest || false,
    versionNotes: row.version_notes || '',
    supersedesId: row.supersedes_id || null,
    claimIds: row.claim_ids || [],
    formulaLineIds: row.formula_line_ids || [],
    referenceIds: row.reference_ids || [],
    revisionEventIds: row.revision_event_ids || [],
    requestIds: row.request_ids || [],
    latestVersionOfId: row.latest_version_of_id || null,
    productName: row.product_name || '',
    formatOverride: row.format_override || '',
    demographic: row.demographic || [],
    biologicalSex: row.biological_sex || [],
    ageGroup: row.age_group || [],
    lifeStage: row.life_stage || [],
    lifestyle: row.lifestyle || [],
    demographicBackfillReview: row.demographic_backfill_review || '',
    dailyServingSize: row.daily_serving_size || '',
    totalEPA: row.total_epa ?? null,
    totalDHA: row.total_dha ?? null,
    totalEPAandDHA: row.total_epa_and_dha ?? null,
    totalOmega6: row.total_omega6 ?? null,
    totalOmega9: row.total_omega9 ?? null,
    createdTime: row.notion_created_at,
    lastEditedTime: row.notion_last_edited_at,
  };
}

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
  if (shouldReadFromPostgres()) {
    try {
      const sb = getPcsSupabase();
      const { data, error } = await sb
        .from('pcs_versions')
        .select('*')
        .eq('pcs_document_id', documentId)
        .order('effective_date', { ascending: false, nullsFirst: false })
        .limit(2000);
      if (error) throw error;
      return (data || []).map(parsePostgresRow);
    } catch (err) {
      console.warn(`[pcs-versions] Postgres forDocument failed, falling back to Notion: ${err.message}`);
    }
  }
  const res = await notion.databases.query({
    database_id: PCS_DB.versions,
    filter: { property: P.pcsDocument, relation: { contains: documentId } },
    sorts: [{ property: P.effectiveDate, direction: 'descending' }],
  });
  return res.results.map(parsePage);
}

export async function getVersion(id) {
  if (shouldReadFromPostgres()) {
    try {
      const sb = getPcsSupabase();
      const { data, error } = await sb
        .from('pcs_versions')
        .select('*')
        .eq('notion_page_id', id)
        .maybeSingle();
      if (error) throw error;
      if (data) return parsePostgresRow(data);
    } catch (err) {
      console.warn(`[pcs-versions] Postgres single-row read failed, falling back to Notion: ${err.message}`);
    }
  }
  const page = await notion.pages.retrieve({ page_id: id });
  return parsePage(page);
}

export async function getAllVersions() {
  if (shouldReadFromPostgres()) {
    try {
      return await _fetchAllVersionsFromPostgres();
    } catch (err) {
      console.warn(`[pcs-versions] Postgres read failed, falling back to Notion: ${err.message}`);
    }
  }
  return _fetchAllVersionsFromNotion();
}

async function _fetchAllVersionsFromNotion() {
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

async function _fetchAllVersionsFromPostgres() {
  // 38 rows today; default Supabase limit covers it with headroom.
  const sb = getPcsSupabase();
  const { data, error } = await sb
    .from('pcs_versions')
    .select('*')
    .order('effective_date', { ascending: false, nullsFirst: false })
    .limit(5000);
  if (error) throw error;
  return (data || []).map(parsePostgresRow);
}

/**
 * 2026-05-06 — Path-2 Day 2.7 drift catcher. See pcs-evidence.js
 * syncRecentEvidenceToPostgres for the full pattern.
 */
export async function syncRecentVersionsToPostgres(sinceIso) {
  const res = await notion.databases.query({
    database_id: PCS_DB.versions,
    filter: { timestamp: 'last_edited_time', last_edited_time: { on_or_after: sinceIso } },
    page_size: 100,
  });
  let maxSeen = sinceIso;
  let mirrored = 0;
  for (const page of res.results) {
    const parsed = parsePage(page);
    const result = await mirrorToPostgres('pcs_versions', parsed, VERSIONS_PG_COLUMN_MAP, { enqueueOnFailure: shouldUseStrongConsistency() });
    if (result.mirrored) mirrored++;
    if (parsed.lastEditedTime > maxSeen) maxSeen = parsed.lastEditedTime;
  }
  return { count: mirrored, maxSeen, fetched: res.results.length };
}

/**
 * Sync a single Notion page into Postgres by page ID.
 * Used by the general page-updated webhook to mirror a specific
 * edited row immediately rather than waiting for the drift-sync cron.
 *
 * @param {string} pageId — Notion page ID
 */
export async function syncSingleVersionPageToPostgres(pageId) {
  const page = await notion.pages.retrieve({ page_id: pageId });
  const parsed = parsePage(page);
  return mirrorToPostgres('pcs_versions', parsed, VERSIONS_PG_COLUMN_MAP, {
    enqueueOnFailure: shouldUseStrongConsistency(),
  });
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

  if (shouldWriteToPostgresFirst()) {
    const preId = crypto.randomUUID();
    const stubRow = {
      id: preId,
      version: fields.version || '',
      pcsDocumentId: fields.pcsDocumentId || null,
      effectiveDate: fields.effectiveDate || null,
      isLatest: fields.isLatest || false,
      versionNotes: fields.versionNotes || '',
      supersedesId: fields.supersedesId || null,
      claimIds: [],
      formulaLineIds: [],
      referenceIds: [],
      revisionEventIds: [],
      requestIds: [],
      latestVersionOfId: fields.latestVersionOfId || null,
      productName: fields.productName || '',
      formatOverride: fields.formatOverride || '',
      demographic: fields.demographic || [],
      biologicalSex: fields.biologicalSex || [],
      ageGroup: fields.ageGroup || [],
      lifeStage: fields.lifeStage || [],
      lifestyle: fields.lifestyle || [],
      demographicBackfillReview: fields.demographicBackfillReview || '',
      dailyServingSize: fields.dailyServingSize || '',
      totalEPA: fields.totalEPA ?? null,
      totalDHA: fields.totalDHA ?? null,
      totalEPAandDHA: fields.totalEPAandDHA ?? null,
      totalOmega6: fields.totalOmega6 ?? null,
      totalOmega9: fields.totalOmega9 ?? null,
    };
    await writePostgresFirst('pcs_versions', stubRow, VERSIONS_PG_COLUMN_MAP, () => notion.pages.create({ parent: { database_id: PCS_DB.versions }, properties }));
    return stubRow;
  }
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

  // 2026-05-06 — Path-2 Day 2.7 write-mirror. Best-effort; failure is logged.
  await mirrorToPostgres('pcs_versions', parsed, VERSIONS_PG_COLUMN_MAP, { enqueueOnFailure: shouldUseStrongConsistency() });
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
  if (shouldWriteToPostgresFirst()) {
    const stubRow = { id, ...fields };
    await writePostgresFirst('pcs_versions', stubRow, VERSIONS_PG_COLUMN_MAP, () => notion.pages.update({ page_id: id, properties }));
    return stubRow;
  }
  const page = await notion.pages.update({ page_id: id, properties });
  const parsed = parsePage(page);
  await mirrorToPostgres('pcs_versions', parsed, VERSIONS_PG_COLUMN_MAP, { enqueueOnFailure: shouldUseStrongConsistency() });
  return parsed;
}
