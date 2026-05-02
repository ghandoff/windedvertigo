/**
 * PCS Evidence Library — full CRUD for the canonical evidence database.
 *
 * Extends the read+SQR operations in pcs.js with complete CRUD,
 * including all fields needed by the PCS portal.
 */

import { PCS_DB, PROPS } from './pcs-config.js';
import { notion } from './notion.js';


const P = PROPS.evidence;

/** Extract the first file URL from a Notion file property. */
function extractFileUrl(prop) {
  const file = prop?.files?.[0];
  if (!file) return null;
  return file.external?.url || file.file?.url || null;
}

function parsePage(page) {
  const p = page.properties;
  return {
    id: page.id,
    name: p[P.name]?.title?.[0]?.plain_text || '',
    citation: (p[P.citation]?.rich_text || []).map(t => t.plain_text).join(''),
    doi: (p[P.doi]?.rich_text || []).map(t => t.plain_text).join(''),
    pmid: (p[P.pmid]?.rich_text || []).map(t => t.plain_text).join(''),
    url: p[P.url]?.url || null,
    evidenceType: p[P.evidenceType]?.select?.name || null,
    ingredient: (p[P.ingredient]?.multi_select || []).map(s => s.name),
    publicationYear: p[P.publicationYear]?.number ?? null,
    canonicalSummary: (p[P.canonicalSummary]?.rich_text || []).map(t => t.plain_text).join(''),
    endnoteGroup: (p[P.endnoteGroup]?.rich_text || []).map(t => t.plain_text).join(''),
    endnoteRecordId: (p[P.endnoteRecordId]?.rich_text || []).map(t => t.plain_text).join(''),
    sqrScore: p[P.sqrScore]?.number ?? null,
    sqrRiskOfBias: p[P.sqrRiskOfBias]?.select?.name || null,
    sqrReviewed: p[P.sqrReviewed]?.checkbox || false,
    sqrReviewDate: p[P.sqrReviewDate]?.date?.start || null,
    sqrReviewUrl: p[P.sqrReviewUrl]?.url || null,
    pdf: extractFileUrl(p[P.pdf]),
    usedInPacketIds: (p[P.usedInPackets]?.relation || []).map(r => r.id),
    pcsReferenceIds: (p[P.pcsReferences]?.relation || []).map(r => r.id),
    // Canonical ingredient multi-relation (Phase 1) — added 2026-04-19
    activeIngredientCanonicalIds: (p[P.activeIngredientCanonical]?.relation || []).map(r => r.id),
    // Wave 5.4 — Ingredient safety cross-check fields (added 2026-04-21).
    // A Research member flags a row by checking `Safety signal` and filling in
    // the structured alert fields; the evidence-updated webhook picks this up
    // and starts the ingredientSafetySweep workflow. See docs/plans/wave-5-product-labels.md §5.
    safetySignal: p[P.safetySignal]?.checkbox || false,
    safetyIngredientIds: (p[P.safetyIngredient]?.relation || []).map(r => r.id),
    safetyDoseThreshold: p[P.safetyDoseThreshold]?.number ?? null,
    safetyDoseUnit: (p[P.safetyDoseUnit]?.rich_text || []).map(t => t.plain_text).join(''),
    safetyDemographicFilterRaw: (p[P.safetyDemographicFilter]?.rich_text || []).map(t => t.plain_text).join(''),
    createdTime: page.created_time,
    lastEditedTime: page.last_edited_time,
  };
}

export async function getAllEvidence(maxPages = 50) {
  let all = [];
  let cursor = undefined;
  let pages = 0;
  do {
    const res = await notion.databases.query({
      database_id: PCS_DB.evidenceLibrary,
      page_size: 100,
      start_cursor: cursor,
    });
    all = all.concat(res.results);
    cursor = res.has_more ? res.next_cursor : undefined;
    pages++;
  } while (cursor && pages < maxPages);
  return all.map(parsePage);
}

export async function getEvidence(id) {
  const page = await notion.pages.retrieve({ page_id: id });
  return parsePage(page);
}

export async function getEvidenceByIngredient(ingredient) {
  const res = await notion.databases.query({
    database_id: PCS_DB.evidenceLibrary,
    filter: { property: P.ingredient, multi_select: { contains: ingredient } },
    sorts: [{ property: P.name, direction: 'ascending' }],
  });
  return res.results.map(parsePage);
}

export async function getEvidenceByType(evidenceType) {
  const res = await notion.databases.query({
    database_id: PCS_DB.evidenceLibrary,
    filter: { property: P.evidenceType, select: { equals: evidenceType } },
    sorts: [{ property: P.name, direction: 'ascending' }],
  });
  return res.results.map(parsePage);
}

export async function getSqrReviewedEvidence() {
  const res = await notion.databases.query({
    database_id: PCS_DB.evidenceLibrary,
    filter: { property: P.sqrReviewed, checkbox: { equals: true } },
    sorts: [{ property: P.sqrScore, direction: 'descending' }],
  });
  return res.results.map(parsePage);
}

export async function getUntaggedEvidence() {
  let all = [];
  let cursor = undefined;
  do {
    const res = await notion.databases.query({
      database_id: PCS_DB.evidenceLibrary,
      filter: { property: P.ingredient, multi_select: { is_empty: true } },
      start_cursor: cursor,
    });
    all = all.concat(res.results);
    cursor = res.has_more ? res.next_cursor : undefined;
  } while (cursor);
  return all.map(parsePage);
}

export async function getUnreviewedEvidence() {
  const res = await notion.databases.query({
    database_id: PCS_DB.evidenceLibrary,
    filter: { property: P.sqrReviewed, checkbox: { equals: false } },
  });
  return res.results.map(parsePage);
}

/**
 * Normalize DOI for uniqueness comparison — mirror of
 * `scripts/audit-evidence-duplicates.mjs`. Keep these two implementations in
 * sync when tightening the rule.
 */
function _normalizeDoi(raw) {
  if (!raw) return null;
  let s = String(raw).trim().toLowerCase();
  if (!s) return null;
  s = s.replace(/^https?:\/\/(dx\.)?doi\.org\//, '');
  s = s.replace(/^doi:\s*/, '').trim();
  if (!s.startsWith('10.')) return null;
  return s;
}

/** Normalize PMID — strip prefix, must be numeric. */
function _normalizePmid(raw) {
  if (!raw) return null;
  const s = String(raw).trim().replace(/^pmid:\s*/i, '').trim();
  if (!/^\d+$/.test(s)) return null;
  return s;
}

/**
 * Check the Evidence Library for existing rows that share a normalized DOI
 * or PMID with the given candidate. Returns the first match or null.
 * Advisory-only (logs a warning in createEvidence); never blocks.
 *
 * Wave 7.0.5 T8 — added 2026-04-21. Per Gina's architecture review, one
 * canonical Evidence row per (DOI OR PMID) is the invariant; duplicates
 * carry per-claim annotation that belongs on the evidence_packet join.
 */
export async function findEvidenceByIdentifier({ doi, pmid }) {
  const normDoi = _normalizeDoi(doi);
  const normPmid = _normalizePmid(pmid);
  if (!normDoi && !normPmid) return null;
  const orFilters = [];
  if (normDoi) orFilters.push({ property: P.doi, rich_text: { contains: normDoi } });
  if (normPmid) orFilters.push({ property: P.pmid, rich_text: { contains: normPmid } });
  try {
    const res = await notion.databases.query({
      database_id: PCS_DB.evidenceLibrary,
      filter: orFilters.length === 1 ? orFilters[0] : { or: orFilters },
      page_size: 5,
    });
    if (!res.results.length) return null;
    // Confirm the normalized match (Notion `contains` is loose on rich_text).
    for (const page of res.results) {
      const parsed = parsePage(page);
      if (normDoi && _normalizeDoi(parsed.doi) === normDoi) return parsed;
      if (normPmid && _normalizePmid(parsed.pmid) === normPmid) return parsed;
    }
    return null;
  } catch (err) {
    // Advisory check — never block creation on lookup failure.
    console.warn(`[evidence] duplicate-lookup failed (non-fatal): ${err.message}`);
    return null;
  }
}

export async function createEvidence(fields) {
  // Wave 7.0.5 T8 — advisory uniqueness check. Logs a warning but never
  // blocks; operators may have legitimate reasons (retraction, corrigendum).
  // Once merge-execution (T8.1) ships, tighten this to a hard constraint.
  if (fields.doi || fields.pmid) {
    const existing = await findEvidenceByIdentifier({ doi: fields.doi, pmid: fields.pmid });
    if (existing) {
      const ident = fields.doi ? `DOI ${fields.doi}` : `PMID ${fields.pmid}`;
      console.warn(`[evidence] duplicate detected: ${ident} already exists on page ${existing.id} ("${existing.name}") — consider re-using instead of creating a new row.`);
    }
  }

  const properties = {
    [P.name]: { title: [{ text: { content: fields.name } }] },
  };
  if (fields.citation) properties[P.citation] = { rich_text: [{ text: { content: fields.citation } }] };
  if (fields.doi) properties[P.doi] = { rich_text: [{ text: { content: fields.doi } }] };
  if (fields.pmid) properties[P.pmid] = { rich_text: [{ text: { content: fields.pmid } }] };
  if (fields.url) properties[P.url] = { url: fields.url };
  if (fields.evidenceType) properties[P.evidenceType] = { select: { name: fields.evidenceType } };
  if (fields.ingredient?.length) {
    properties[P.ingredient] = { multi_select: fields.ingredient.map(name => ({ name })) };
  }
  if (fields.publicationYear !== undefined) properties[P.publicationYear] = { number: fields.publicationYear };
  if (fields.canonicalSummary) properties[P.canonicalSummary] = { rich_text: [{ text: { content: fields.canonicalSummary } }] };
  if (fields.endnoteGroup) properties[P.endnoteGroup] = { rich_text: [{ text: { content: fields.endnoteGroup } }] };
  if (fields.endnoteRecordId) properties[P.endnoteRecordId] = { rich_text: [{ text: { content: fields.endnoteRecordId } }] };
  if (fields.pdf) properties[P.pdf] = { files: [{ name: 'PDF', type: 'external', external: { url: fields.pdf } }] };

  const page = await notion.pages.create({
    parent: { database_id: PCS_DB.evidenceLibrary },
    properties,
  });
  return parsePage(page);
}

export async function updateEvidence(id, fields) {
  const properties = {};
  if (fields.name !== undefined) {
    properties[P.name] = { title: [{ text: { content: fields.name } }] };
  }
  if (fields.citation !== undefined) {
    properties[P.citation] = { rich_text: [{ text: { content: fields.citation } }] };
  }
  if (fields.doi !== undefined) {
    properties[P.doi] = { rich_text: [{ text: { content: fields.doi } }] };
  }
  if (fields.pmid !== undefined) {
    properties[P.pmid] = { rich_text: [{ text: { content: fields.pmid } }] };
  }
  if (fields.url !== undefined) {
    properties[P.url] = fields.url ? { url: fields.url } : { url: null };
  }
  if (fields.evidenceType !== undefined) {
    properties[P.evidenceType] = { select: { name: fields.evidenceType } };
  }
  if (fields.ingredient !== undefined) {
    properties[P.ingredient] = { multi_select: fields.ingredient.map(name => ({ name })) };
  }
  if (fields.publicationYear !== undefined) {
    properties[P.publicationYear] = { number: fields.publicationYear };
  }
  if (fields.canonicalSummary !== undefined) {
    properties[P.canonicalSummary] = { rich_text: [{ text: { content: fields.canonicalSummary } }] };
  }
  if (fields.sqrScore !== undefined) {
    properties[P.sqrScore] = { number: fields.sqrScore };
  }
  if (fields.sqrRiskOfBias !== undefined) {
    properties[P.sqrRiskOfBias] = { select: { name: fields.sqrRiskOfBias } };
  }
  if (fields.sqrReviewed !== undefined) {
    properties[P.sqrReviewed] = { checkbox: fields.sqrReviewed };
  }
  if (fields.sqrReviewDate !== undefined) {
    properties[P.sqrReviewDate] = fields.sqrReviewDate
      ? { date: { start: fields.sqrReviewDate } }
      : { date: null };
  }
  if (fields.sqrReviewUrl !== undefined) {
    properties[P.sqrReviewUrl] = fields.sqrReviewUrl ? { url: fields.sqrReviewUrl } : { url: null };
  }
  if (fields.pdf !== undefined) {
    properties[P.pdf] = fields.pdf
      ? { files: [{ name: 'PDF', type: 'external', external: { url: fields.pdf } }] }
      : { files: [] };
  }
  if (fields.activeIngredientCanonicalIds !== undefined) {
    properties[P.activeIngredientCanonical] = {
      relation: (fields.activeIngredientCanonicalIds || []).map(rid => ({ id: rid })),
    };
  }
  const page = await notion.pages.update({ page_id: id, properties });
  return parsePage(page);
}
