/**
 * Wave 4.5.4 — PCS Research Requests health metrics.
 *
 * Three point-in-time metrics computed fresh from Notion:
 *   1) Median time-to-resolve (days), sliced by request type and assigned role.
 *   2) Coverage debt — % of active PCS Documents with at least one open request.
 *   3) Queue staleness — p50 / p95 open age in days; oldest open request.
 *
 * Pure helpers: they take options, return structured data, and have no UI concerns.
 * Both the /api/pcs/requests/metrics route and the weekly-digest workflow consume
 * `computeAllMetrics()` so the numbers stay consistent between surfaces.
 */

import { PCS_DB, PROPS } from './pcs-config.js';
import { notion } from './notion.js';
import { getAllDocuments } from './pcs-documents.js';
import { queryRequests } from './pcs-requests.js';

const P = PROPS.requests;

/* -------------------------------------------------------------------------- */
/* Pure stats helpers                                                         */
/* -------------------------------------------------------------------------- */

export function percentile(values, p) {
  if (!Array.isArray(values) || values.length === 0) return null;
  const sorted = [...values].filter(v => typeof v === 'number' && Number.isFinite(v)).sort((a, b) => a - b);
  if (sorted.length === 0) return null;
  if (sorted.length === 1) return sorted[0];
  const idx = (p / 100) * (sorted.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  const frac = idx - lo;
  return sorted[lo] * (1 - frac) + sorted[hi] * frac;
}

export function median(values) {
  return percentile(values, 50);
}

function daysBetween(laterIso, earlierIso) {
  const later = new Date(laterIso).getTime();
  const earlier = new Date(earlierIso).getTime();
  if (!Number.isFinite(later) || !Number.isFinite(earlier)) return null;
  return Math.max(0, (later - earlier) / 86400000);
}

function roundDays(n) {
  if (n == null || !Number.isFinite(n)) return null;
  return Math.round(n * 10) / 10;
}

/* -------------------------------------------------------------------------- */
/* Resolved-requests query for median-time-to-resolve                         */
/* -------------------------------------------------------------------------- */

/**
 * Query Done requests whose completion timestamp falls within the last
 * `windowDays`. Completion is the max of `raCompleted` / `resCompleted` on the
 * row (whichever is populated); if neither is set we fall back to `last_edited_time`.
 */
async function fetchRecentlyResolvedRequests(windowDays = 90) {
  const res = await notion.databases.query({
    database_id: PCS_DB.requests,
    filter: { property: P.status, status: { equals: 'Done' } },
    page_size: 100,
  });
  const cutoff = Date.now() - windowDays * 86400000;
  const rows = [];
  for (const page of res.results) {
    const props = page.properties;
    const openedDate = props[P.openedDate]?.date?.start
      || (page.created_time ? page.created_time.slice(0, 10) : null);
    const raCompleted = props[P.raCompleted]?.date?.start || null;
    const resCompleted = props[P.resCompleted]?.date?.start || null;
    const completedCandidates = [raCompleted, resCompleted].filter(Boolean);
    const completedAt = completedCandidates.length > 0
      ? completedCandidates.sort().slice(-1)[0]
      : (page.last_edited_time ? page.last_edited_time.slice(0, 10) : null);
    if (!openedDate || !completedAt) continue;
    const completedMs = new Date(completedAt).getTime();
    if (!Number.isFinite(completedMs) || completedMs < cutoff) continue;
    const d = daysBetween(completedAt, openedDate);
    if (d == null) continue;
    rows.push({
      id: page.id,
      requestType: props[P.requestType]?.select?.name || null,
      assignedRole: props[P.assignedRole]?.select?.name || null,
      openedDate,
      completedAt,
      resolveDays: d,
    });
  }
  return rows;
}

/* -------------------------------------------------------------------------- */
/* Metric 1 — median time-to-resolve                                          */
/* -------------------------------------------------------------------------- */

const REQUEST_TYPES = ['low-confidence', 'template-drift', 'label-drift'];
const ROLES = ['Research', 'RA', 'Template-owner'];

export async function computeMedianTimeToResolve({ windowDays = 90 } = {}) {
  const rows = await fetchRecentlyResolvedRequests(windowDays);
  const all = rows.map(r => r.resolveDays);
  const byType = {};
  for (const t of REQUEST_TYPES) {
    const slice = rows.filter(r => r.requestType === t).map(r => r.resolveDays);
    byType[t] = slice.length > 0 ? roundDays(median(slice)) : null;
  }
  const byRole = {};
  for (const role of ROLES) {
    const slice = rows.filter(r => r.assignedRole === role).map(r => r.resolveDays);
    byRole[role] = slice.length > 0 ? roundDays(median(slice)) : null;
  }
  return {
    all: rows.length > 0 ? roundDays(median(all)) : null,
    byType,
    byRole,
    basedOn: rows.length,
    windowDays,
  };
}

/* -------------------------------------------------------------------------- */
/* Metric 2 — coverage debt                                                   */
/* -------------------------------------------------------------------------- */

export async function computeCoverageDebt() {
  const [documents, openRequests] = await Promise.all([
    getAllDocuments(),
    queryRequests({ filter: 'all' }),
  ]);
  const activeDocs = documents.filter(d => !d.archived);
  const totalActivePcs = activeDocs.length;
  const activeIds = new Set(activeDocs.map(d => d.id));
  const pcsWithOpen = new Set();
  for (const req of openRequests) {
    if (req.relatedPcsId && activeIds.has(req.relatedPcsId)) {
      pcsWithOpen.add(req.relatedPcsId);
    }
  }
  const pcsWithOpenRequests = pcsWithOpen.size;
  const pct = totalActivePcs > 0
    ? Math.round((pcsWithOpenRequests / totalActivePcs) * 1000) / 10
    : 0;
  return {
    pctDocumentsWithOpenRequests: pct,
    totalActivePcs,
    pcsWithOpenRequests,
  };
}

/* -------------------------------------------------------------------------- */
/* Metric 3 — staleness                                                       */
/* -------------------------------------------------------------------------- */

export async function computeStaleness() {
  const openRequests = await queryRequests({ filter: 'all' });
  const ages = openRequests
    .map(r => (typeof r.ageDays === 'number' ? r.ageDays : null))
    .filter(v => v != null);

  const p50 = ages.length > 0 ? roundDays(percentile(ages, 50)) : null;
  const p95 = ages.length > 0 ? roundDays(percentile(ages, 95)) : null;

  let oldest = null;
  for (const r of openRequests) {
    if (typeof r.ageDays !== 'number') continue;
    if (!oldest || r.ageDays > oldest.ageDays) {
      oldest = {
        id: r.id,
        pcsId: r.relatedPcsId || null,
        ageDays: r.ageDays,
      };
    }
  }

  return {
    p50OpenAgeDays: p50,
    p95OpenAgeDays: p95,
    oldestOpenRequest: oldest,
    alert: typeof p95 === 'number' && p95 > 30,
    openCount: openRequests.length,
  };
}

/* -------------------------------------------------------------------------- */
/* Aggregator                                                                 */
/* -------------------------------------------------------------------------- */

export async function computeAllMetrics({ windowDays = 90 } = {}) {
  const [medianTimeToResolve, coverageDebt, staleness] = await Promise.all([
    computeMedianTimeToResolve({ windowDays }),
    computeCoverageDebt(),
    computeStaleness(),
  ]);
  return { medianTimeToResolve, coverageDebt, staleness };
}
