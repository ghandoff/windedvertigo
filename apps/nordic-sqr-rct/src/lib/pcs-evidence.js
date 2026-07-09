/**
 * PCS Evidence Library — full CRUD for the canonical evidence database.
 *
 * Extends the read+SQR operations in pcs.js with complete CRUD,
 * including all fields needed by the PCS portal.
 */

import { PCS_DB, PROPS } from './pcs-config.js';
import { notion } from './notion.js';
import { memoize, invalidate as invalidateCache } from './in-memory-cache.js';
import {
  getPcsSupabase, mirrorToPostgres,
  shouldUseStrongConsistency, writePostgresFirst,
} from './supabase-pcs.js';

// 2026-05-06 — column-name overrides for evidence's Notion → Postgres
// mirror. Most fields follow camelCase → snake_case; these don't.
// 2026-05-16 — pdf analytics fields added (Postgres-only, not in Notion).
// 2026-06-14 — visibility field added (Budget C Phase 5, migration 021 column).
const EVIDENCE_PG_COLUMN_MAP = {
  pdf: 'pdf_url',
  pdfSource: 'pdf_source',
  pdfRetrievedAt: 'pdf_retrieved_at',
  pdfPlatformRetrieved: 'pdf_platform_retrieved',
  publisherCostUsd: 'publisher_cost_usd',
};

// DOI prefixes for fully open-access publishers — no purchase cost for these.
const OA_PUBLISHER_DOI_PREFIXES = [
  '10.3390', // MDPI
  '10.3389', // Frontiers
  '10.1371', // PLOS
  '10.7554', // eLife
  '10.1186', // BioMed Central
];

/**
 * Estimate the publisher purchase price for a closed-access article.
 * Returns 0.00 for known fully-OA publishers, 35.00 (industry average) otherwise.
 * Used to stamp publisher_cost_usd on Evidence rows for cost-savings analytics.
 */
export function estimatePublisherCost(doi) {
  if (!doi) return 35.00;
  return OA_PUBLISHER_DOI_PREFIXES.some(p => doi.startsWith(p)) ? 0.00 : 35.00;
}


const P = PROPS.evidence;

// 2026-05-05 — Phase 3 Bundle 1. The Evidence Library backs the busiest
// /pcs/evidence index page; its `getAllEvidence` paginates Notion (100
// rows/query, up to 50 pages = 1.5–7s cold-cache cost on tables with
// ~200+ rows). Memoize the default-args call so the second hit within
// `EVIDENCE_CACHE_TTL_MS` lands in process memory (5–20ms) instead.
// Vercel Fluid Compute reuses instances across concurrent requests so
// after the first user paid the pagination cost, the team gets sub-50ms.
//
// Writes (createEvidence / updateEvidence) call `invalidateEvidenceCache`
// so the next read picks up the change. Same pattern Phase 2 used in
// pcs-ingredients.js / pcs-canonical-claims.js / pcs-core-benefits.js.
const EVIDENCE_CACHE_KEY = 'evidence:all:50';
const EVIDENCE_CACHE_TTL_MS = 60_000; // 60s — evidence list is read-mostly; writes invalidate immediately

export function invalidateEvidenceCache() {
  invalidateCache(EVIDENCE_CACHE_KEY);
}

/** Extract the first file URL from a Notion file property. */
function extractFileUrl(prop) {
  const file = prop?.files?.[0];
  if (!file) return null;
  return file.external?.url || file.file?.url || null;
}

/**
 * 2026-05-06 — Path-2 read-path swap. Convert a Postgres pcs_evidence
 * row into the SAME shape parsePage(notionPage) returns. Downstream
 * callers (route handlers, PcsTable, ArticleSearchPanel) must not be
 * able to tell whether the data came from Notion or Postgres.
 *
 * Mapping notes:
 *   - id: returns notion_page_id (NOT the Postgres uuid). Notion-id
 *     is what the rest of the app uses for routing (/pcs/evidence/[id]),
 *     for relations (used_in_packet_ids, etc.), and for Notion round-trips.
 *   - createdTime / lastEditedTime: come from notion_created_at /
 *     notion_last_edited_at (the mirrored Notion timestamps), NOT from
 *     created_at / updated_at (which are Postgres-side write times).
 *   - Empty strings vs null: matches Notion shape exactly. Notion's
 *     parsePage returns '' for unset rich_text fields and null for
 *     unset numbers/dates/selects. We mirror that: postgres TEXT
 *     defaults '' come through as '', NUMERIC nulls come through as null.
 *   - pdf: stored as `pdf_url` in Postgres (column name) but exposed
 *     as `pdf` here (matches the Notion property semantic).
 */
function parsePostgresRow(row) {
  return {
    id: row.notion_page_id,
    name: row.name || '',
    citation: row.citation || '',
    doi: row.doi || '',
    pmid: row.pmid || '',
    url: row.url || null,
    evidenceType: row.evidence_type || null,
    ingredient: row.ingredient || [],
    publicationYear: row.publication_year ?? null,
    canonicalSummary: row.canonical_summary || '',
    endnoteGroup: row.endnote_group || '',
    endnoteRecordId: row.endnote_record_id || '',
    sqrScore: row.sqr_score ?? null,
    sqrRiskOfBias: row.sqr_risk_of_bias || null,
    sqrReviewed: row.sqr_reviewed || false,
    sqrReviewDate: row.sqr_review_date || null,
    sqrReviewUrl: row.sqr_review_url || null,
    pdf: row.pdf_url || null,
    usedInPacketIds: row.used_in_packet_ids || [],
    pcsReferenceIds: row.pcs_reference_ids || [],
    activeIngredientCanonicalIds: row.active_ingredient_canonical_ids || [],
    safetySignal: row.safety_signal || false,
    safetyIngredientIds: row.safety_ingredient_ids || [],
    safetyDoseThreshold: row.safety_dose_threshold ?? null,
    safetyDoseUnit: row.safety_dose_unit || '',
    safetyDemographicFilterRaw: row.safety_demographic_filter_raw || '',
    createdTime: row.notion_created_at,
    lastEditedTime: row.notion_last_edited_at,
    visibility: row.visibility || 'shared',
  };
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
    visibility: 'shared', // Notion has no visibility field; default shared for all Notion-sourced rows
  };
}

export async function getAllEvidence(maxPages = 50, opts = {}) {
  // Hot-path cache: only the default-args call is memoized. Custom
  // maxPages or skipCache callers always see fresh data. Mirrors
  // getAllIngredients (Phase 2 pattern).
  if (maxPages === 50 && !opts.skipCache) {
    return memoize(EVIDENCE_CACHE_KEY, EVIDENCE_CACHE_TTL_MS, () =>
      _fetchAllEvidence(maxPages),
    );
  }
  return _fetchAllEvidence(maxPages);
}

async function _fetchAllEvidence(maxPages) {
  return await _fetchAllEvidenceFromPostgres();
}

/**
 * 2026-05-06 — Path-2 drift catcher. Called every few minutes by
 * /api/cron/drift-sync to pull any direct-Notion edits into Postgres
 * (i.e. Sharon edits a row in Notion's web UI, bypassing our platform).
 *
 * Filters Notion for rows where last_edited_time >= sinceIso, then
 * mirrors each to Postgres. Idempotent: re-running with the same
 * sinceIso just re-mirrors the same rows. Returns { count, maxSeen }.
 *
 * The cron uses the previous run's maxSeen as the next run's sinceIso
 * (with a small overlap window to avoid clock-skew gaps).
 */
export async function syncRecentEvidenceToPostgres(sinceIso) {
  const filter = {
    timestamp: 'last_edited_time',
    last_edited_time: { on_or_after: sinceIso },
  };
  const res = await notion.databases.query({
    database_id: PCS_DB.evidenceLibrary,
    filter,
    page_size: 100,
  });
  let maxSeen = sinceIso;
  let mirrored = 0;
  for (const page of res.results) {
    const parsed = parsePage(page);
    const result = await mirrorToPostgres('pcs_evidence', parsed, EVIDENCE_PG_COLUMN_MAP, { enqueueOnFailure: shouldUseStrongConsistency() });
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
export async function syncSingleEvidencePageToPostgres(pageId) {
  const page = await notion.pages.retrieve({ page_id: pageId });
  const parsed = parsePage(page);
  return mirrorToPostgres('pcs_evidence', parsed, EVIDENCE_PG_COLUMN_MAP, {
    enqueueOnFailure: shouldUseStrongConsistency(),
  });
}

async function _fetchAllEvidenceFromPostgres() {
  // Single round-trip — no pagination needed; Supabase returns up to
  // 1000 rows by default which comfortably fits 87-row evidence table
  // (and the schema allows the table to grow well beyond that without
  // hitting limits — increase `range` if it ever becomes relevant).
  const sb = getPcsSupabase();
  const { data, error } = await sb
    .from('pcs_evidence')
    .select('*')
    .order('notion_last_edited_at', { ascending: false })
    .limit(2000);
  if (error) throw error;
  return (data || []).map(parsePostgresRow);
}

export async function getEvidence(id) {
  const sb = getPcsSupabase();
  const { data, error } = await sb
    .from('pcs_evidence')
    .select('*')
    .eq('notion_page_id', id)
    .maybeSingle();
  if (error) throw error;
  return data ? parsePostgresRow(data) : null;
}

// 2026-05-06 — Path-2 swap on by-filter helpers. Postgres has GIN
// index on `ingredient` (text[]) so `.contains()` is fast; the rest
// use B-tree on the relevant column.

export async function getEvidenceByIngredient(ingredient) {
  const sb = getPcsSupabase();
  const { data, error } = await sb
    .from('pcs_evidence')
    .select('*')
    .contains('ingredient', [ingredient])
    .order('name', { ascending: true })
    .limit(2000);
  if (error) throw error;
  return (data || []).map(parsePostgresRow);
}

export async function getEvidenceByType(evidenceType) {
  const sb = getPcsSupabase();
  const { data, error } = await sb
    .from('pcs_evidence')
    .select('*')
    .eq('evidence_type', evidenceType)
    .order('name', { ascending: true })
    .limit(2000);
  if (error) throw error;
  return (data || []).map(parsePostgresRow);
}

export async function getSqrReviewedEvidence() {
  const sb = getPcsSupabase();
  const { data, error } = await sb
    .from('pcs_evidence')
    .select('*')
    .eq('sqr_reviewed', true)
    .order('sqr_score', { ascending: false, nullsFirst: false })
    .limit(2000);
  if (error) throw error;
  return (data || []).map(parsePostgresRow);
}

export async function getUntaggedEvidence() {
  const sb = getPcsSupabase();
  // PostgREST: filter where ingredient array length is 0
  const { data, error } = await sb
    .from('pcs_evidence')
    .select('*')
    .eq('ingredient', '{}')
    .limit(2000);
  if (error) throw error;
  return (data || []).map(parsePostgresRow);
}

export async function getUnreviewedEvidence() {
  const sb = getPcsSupabase();
  const { data, error } = await sb
    .from('pcs_evidence')
    .select('*')
    .eq('sqr_reviewed', false)
    .limit(2000);
  if (error) throw error;
  return (data || []).map(parsePostgresRow);
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

  // 2026-05-06 — Path-2 swap. Postgres has indexes on doi + pmid
  // (CREATE INDEX pcs_evidence_doi_idx + pcs_evidence_pmid_idx in 001),
  // so this query is sub-10ms vs Notion's 200-500ms `contains` filter.
  // High-impact swap: this runs INSIDE every createEvidence call as
  // the dedup gate, so it's on the hot path for save-from-search and
  // every EndNote import.
  const sb = getPcsSupabase();
  // Use ilike for case-insensitive match; the indexes still apply.
  // Build OR filter via PostgREST `.or()` syntax.
  const orParts = [];
  if (normDoi) orParts.push(`doi.ilike.${normDoi}`);
  if (normPmid) orParts.push(`pmid.eq.${normPmid}`);
  const { data, error } = await sb
    .from('pcs_evidence')
    .select('*')
    .or(orParts.join(','))
    .limit(5);
  if (error) throw error;
  // Re-confirm the normalized match (PostgREST `ilike` is case-
  // insensitive but doesn't normalize doi.org prefix, etc.).
  for (const row of data || []) {
    const parsed = parsePostgresRow(row);
    if (normDoi && _normalizeDoi(parsed.doi) === normDoi) return parsed;
    if (normPmid && _normalizePmid(parsed.pmid) === normPmid) return parsed;
  }
  return null;
}

export async function createEvidence(fields) {
  // Wave 7.0.5 T8.1 — hard-merge dedup (2026-05-05).
  //
  // When an existing row matches by exact DOI or PMID, return THAT row
  // instead of creating a duplicate. Optionally enrich the existing
  // row with non-empty fields the existing row was missing — never
  // overwrite operator-curated data. This replaces the previous T8
  // advisory check, which logged a warning but still created the dup.
  //
  // The returned object includes a `_wasMerged: true` flag plus
  // `_enrichedFields: string[]` listing which gaps got filled, so
  // callers (save-from-search, EndNote import, etc.) can show
  // appropriate UI. Callers that don't read the flag still get the
  // existing row's id and parsed shape, which is the safe default.
  //
  // Edge case — retraction / corrigendum / superseded paper: passing
  // `forceCreate: true` opts out and creates a new row regardless.
  // Reserved for explicit operator action; not exposed in standard
  // create paths today.
  if ((fields.doi || fields.pmid) && !fields.forceCreate) {
    const existing = await findEvidenceByIdentifier({ doi: fields.doi, pmid: fields.pmid });
    if (existing) {
      const ident = fields.doi ? `DOI ${fields.doi}` : `PMID ${fields.pmid}`;

      // Compute gap-fills: only set fields the existing row is missing.
      // String fields use truthiness; numbers/booleans use null/undefined
      // checks so we don't clobber an existing 0 / false.
      const enrichments = {};
      if (!existing.pdf && fields.pdf) enrichments.pdf = fields.pdf;
      if (!existing.canonicalSummary && fields.canonicalSummary) enrichments.canonicalSummary = fields.canonicalSummary;
      if (existing.publicationYear == null && fields.publicationYear != null) enrichments.publicationYear = fields.publicationYear;
      if (!existing.url && fields.url) enrichments.url = fields.url;
      if (!existing.evidenceType && fields.evidenceType) enrichments.evidenceType = fields.evidenceType;
      if (!existing.citation && fields.citation) enrichments.citation = fields.citation;
      if (!existing.pmid && fields.pmid) enrichments.pmid = fields.pmid;
      if (!existing.doi && fields.doi) enrichments.doi = fields.doi;
      if ((!existing.ingredient || existing.ingredient.length === 0) && fields.ingredient?.length > 0) {
        enrichments.ingredient = fields.ingredient;
      }
      // 2026-05-16 — analytics: if this merge brings a platform-retrieved PDF
      // to an existing row that lacked one, stamp the retrieval metadata.
      if (!existing.pdfSource && fields.pdfSource) enrichments.pdfSource = fields.pdfSource;
      if (!existing.pdfPlatformRetrieved && fields.pdfPlatformRetrieved) {
        enrichments.pdfPlatformRetrieved = fields.pdfPlatformRetrieved;
        enrichments.pdfRetrievedAt = fields.pdfRetrievedAt || new Date().toISOString();
        enrichments.publisherCostUsd = fields.publisherCostUsd ?? estimatePublisherCost(fields.doi);
      }

      const enrichedFields = Object.keys(enrichments);
      if (enrichedFields.length > 0) {
        const enriched = await updateEvidence(existing.id, enrichments);
        console.log(`[evidence] hard-merge: ${ident} merged into ${existing.id} (enriched: ${enrichedFields.join(', ')})`);
        return { ...enriched, _wasMerged: true, _enrichedFields: enrichedFields };
      }
      console.log(`[evidence] hard-merge: ${ident} matches ${existing.id} — returning existing as-is`);
      return { ...existing, _wasMerged: true, _enrichedFields: [] };
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

  // 2026-05-07 — Phase B: write Postgres first, Notion async.
  // Evidence is Tier 3 (highest-relation table); this only activates when
  // PCS_WRITE_TO_POSTGRES=1. The hard-merge path above stays on Phase A
  // semantics even when Phase B is on (updateEvidence already handles its
  // own flag, so _wasMerged propagates correctly).
  const preId = crypto.randomUUID();
  const stubRow = {
    id: preId,
    name: fields.name || '',
    citation: fields.citation || '',
    doi: fields.doi || '',
    pmid: fields.pmid || '',
    url: fields.url || null,
    evidenceType: fields.evidenceType || null,
    ingredient: fields.ingredient || [],
    publicationYear: fields.publicationYear ?? null,
    canonicalSummary: fields.canonicalSummary || '',
    endnoteGroup: fields.endnoteGroup || '',
    endnoteRecordId: fields.endnoteRecordId || '',
    pdf: fields.pdf || null, // notionShapeToPgRow maps 'pdf' → 'pdf_url' via EVIDENCE_PG_COLUMN_MAP
    // 2026-05-16 — analytics fields (Postgres-only)
    pdfSource: fields.pdfSource || null,
    pdfRetrievedAt: fields.pdfRetrievedAt || null,
    pdfPlatformRetrieved: fields.pdfPlatformRetrieved || false,
    publisherCostUsd: fields.publisherCostUsd ?? estimatePublisherCost(fields.doi),
    visibility: fields.visibility || 'shared',
  };
  await writePostgresFirst('pcs_evidence', stubRow, EVIDENCE_PG_COLUMN_MAP);
  invalidateEvidenceCache();
  return stubRow;
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
  // 2026-05-07 — Phase B: stub carries only the fields being updated.
  const stubRow = { id, ...fields };
  await writePostgresFirst('pcs_evidence', stubRow, EVIDENCE_PG_COLUMN_MAP);
  invalidateEvidenceCache();
  return stubRow; // optimistic; _wasMerged propagates from createEvidence caller if needed
}
