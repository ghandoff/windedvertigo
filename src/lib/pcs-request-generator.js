/**
 * Wave 4.5.0 — Research Requests generator.
 *
 * Pure module (no side effects at import time) that turns validation signals
 * from a commit-time extraction into durable rows in the PCS Requests DB.
 *
 * Two loops, per docs/plans/wave-4.5-extractor-validation.md §3:
 *   A. Per-field / per-item confidence < threshold → 'low-confidence' request.
 *   B. templateVersion !== 'Lauren v1.0'           → 'template-drift' request.
 *
 * The public entry point is idempotent via upsertRequest(): a matching OPEN
 * request (same Related PCS + Request type + Specific field, Status != Done)
 * is updated instead of duplicated. Done requests are never reopened — a
 * new row is created, giving a clean audit trail.
 *
 * IMPORTANT: this module is best-effort. Callers (currently commitExtraction)
 * wrap it in try/catch so a generator bug never fails an import.
 */

import { PCS_DB, PROPS } from './pcs-config.js';
import { notion, withRetry } from './notion.js';

const P = PROPS.requests;

// ─── Configuration ──────────────────────────────────────────────────────────

/** Default low-confidence threshold; overridable via env. */
const DEFAULT_CONFIDENCE_THRESHOLD = 0.7;

function getConfidenceThreshold() {
  const raw = process.env.PCS_REQUEST_CONFIDENCE_THRESHOLD;
  const n = raw ? Number(raw) : NaN;
  return Number.isFinite(n) && n > 0 && n <= 1 ? n : DEFAULT_CONFIDENCE_THRESHOLD;
}

// ─── Routing table (plan §4) ────────────────────────────────────────────────

/** Fields owned by Research. */
const RESEARCH_FIELDS = new Set([
  'fmPlm',
  'ingredientSource',
  'ai',
  'aiForm',
  'demographic',
  'finishedGoodName',
  'fmt',
  'keyTakeaway',
  'studyDesignSummary',
  'canonicalSummary',
  'totalEPA',
  'totalDHA',
  'totalEPAandDHA',
]);

/** Fields owned by RA. */
const RA_FIELDS = new Set([
  'claim',
  'claimStatus',
  'claimBucket',
  'disclaimerRequired',
  'substantiationTier',
]);

/** Fields owned by the Template-owner (Lauren). */
const TEMPLATE_OWNER_FIELDS = new Set([
  'template-version',
  'tableB',
  'table4-narrative',
  'revision-event-prefix',
]);

/**
 * Map a field name or signal label to the responsible role.
 * Defensive default: 'Research'. Deeper dotted paths (e.g. 'evidencePackets.keyTakeaway',
 * 'doseRequirements.amount') are resolved by matching any segment.
 */
export function routeFieldToRole(fieldName) {
  if (!fieldName || typeof fieldName !== 'string') return 'Research';

  if (TEMPLATE_OWNER_FIELDS.has(fieldName)) return 'Template-owner';

  // Normalize dotted paths like "evidencePackets.keyTakeaway" or "claims[3].claim"
  const segments = fieldName
    .replace(/\[\d+\]/g, '')
    .split('.')
    .map(s => s.trim())
    .filter(Boolean);

  for (const seg of segments) {
    if (TEMPLATE_OWNER_FIELDS.has(seg)) return 'Template-owner';
    if (RA_FIELDS.has(seg)) return 'RA';
    if (RESEARCH_FIELDS.has(seg)) return 'Research';
  }

  // doseRequirements.* → RA-adjacent but plan §4 assigns to Research (dose validation).
  if (segments.includes('doseRequirements')) return 'Research';
  // evidencePackets.* → Research (study narratives).
  if (segments.includes('evidencePackets')) return 'Research';

  return 'Research';
}

/**
 * Wave 4.5.0: no load-balancing yet (no assignee pool configured). Returns null
 * so the Unassigned view catches these and Research/RA leads can hand-route.
 * Wave 4.5.1 will add round-robin using NOTION_PCS_RA_USER_IDS /
 * NOTION_PCS_TEMPLATE_OWNER_USER_ID.
 */
export function pickAssignee(_role) {
  return null;
}

// ─── Notion helpers ─────────────────────────────────────────────────────────

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function buildProperties({
  title,
  notes,
  documentId,
  versionId,
  type,
  specificField,
  assignedRole,
  assignee,
  priority,
  source,
  openedDate,
  lastPingedDate,
  status,
}) {
  const properties = {};
  if (title !== undefined) {
    properties[P.request] = { title: [{ text: { content: title.slice(0, 200) } }] };
  }
  if (notes !== undefined) {
    properties[P.requestNotes] = { rich_text: [{ text: { content: String(notes).slice(0, 1900) } }] };
  }
  if (documentId) {
    properties[P.relatedPcs] = { relation: [{ id: documentId }] };
  }
  if (versionId) {
    properties[P.pcsVersion] = { relation: [{ id: versionId }] };
  }
  if (type) {
    properties[P.requestType] = { select: { name: type } };
  }
  if (specificField !== undefined) {
    properties[P.specificField] = { rich_text: [{ text: { content: String(specificField).slice(0, 400) } }] };
  }
  if (assignedRole) {
    properties[P.assignedRole] = { select: { name: assignedRole } };
  }
  if (Array.isArray(assignee) && assignee.length > 0) {
    properties[P.assignee] = { people: assignee.map(id => ({ id })) };
  }
  if (priority) {
    properties[P.priority] = { select: { name: priority } };
  }
  if (source) {
    properties[P.source] = { select: { name: source } };
  }
  if (openedDate) {
    properties[P.openedDate] = { date: { start: openedDate } };
  }
  if (lastPingedDate) {
    properties[P.lastPingedDate] = { date: { start: lastPingedDate } };
  }
  if (status) {
    properties[P.status] = { status: { name: status } };
  }
  return properties;
}

/**
 * Find an existing open (Status != Done) request matching the dedup key.
 * Returns the matching Notion page or null.
 */
async function findOpenMatch({ documentId, type, specificField }) {
  const filters = [
    { property: P.relatedPcs, relation: { contains: documentId } },
    { property: P.requestType, select: { equals: type } },
    { property: P.status, status: { does_not_equal: 'Done' } },
  ];
  // specificField is rich_text — Notion rich_text.equals is not supported; use contains
  // on the exact string. Field names in this system are short, distinct identifiers
  // so false-positive matches are highly unlikely.
  if (specificField) {
    filters.push({ property: P.specificField, rich_text: { equals: specificField } });
  }
  const res = await withRetry(() => notion.databases.query({
    database_id: PCS_DB.requests,
    filter: { and: filters },
    page_size: 5,
  }));
  return res.results[0] || null;
}

/**
 * Upsert a request. If an open match exists (dedup key = documentId + type +
 * specificField), patch it (bump Last pinged date, update notes/priority/assignee).
 * Otherwise create a new row with Status = 'New' and Opened date = today.
 *
 * @returns {{ action: 'created' | 'updated' | 'skipped', id: string | null }}
 */
export async function upsertRequest(input) {
  const {
    documentId,
    versionId,
    type,
    specificField,
    title,
    notes,
    assignedRole,
    assignee = pickAssignee(assignedRole),
    priority = 'Normal',
    source = 'auto-on-commit',
  } = input;

  if (!documentId) return { action: 'skipped', id: null };
  if (!type) return { action: 'skipped', id: null };
  if (!PCS_DB.requests) return { action: 'skipped', id: null };

  const existing = await findOpenMatch({ documentId, type, specificField });
  const assigneeIds = assignee ? (Array.isArray(assignee) ? assignee : [assignee]) : null;

  if (existing) {
    const properties = buildProperties({
      notes,
      priority,
      assignedRole,
      assignee: assigneeIds,
      lastPingedDate: todayIso(),
    });
    const page = await withRetry(() => notion.pages.update({
      page_id: existing.id,
      properties,
    }));
    return { action: 'updated', id: page.id };
  }

  const properties = buildProperties({
    title,
    notes,
    documentId,
    versionId,
    type,
    specificField,
    assignedRole,
    assignee: assigneeIds,
    priority,
    source,
    openedDate: todayIso(),
    lastPingedDate: todayIso(),
    status: 'New',
  });
  const page = await withRetry(() => notion.pages.create({
    parent: { database_id: PCS_DB.requests },
    properties,
  }));
  return { action: 'created', id: page.id };
}

// ─── Confidence walkers ─────────────────────────────────────────────────────

/**
 * Walk an extraction object and yield { field, score } pairs.
 *
 * Supports TWO extraction shapes:
 *   1. Plan's future shape — extraction.confidence.perField: Record<string, number>.
 *   2. Current shape (PROMPT_VERSION v2.2-confidence) — per-item `confidence` on
 *      claims[], formulaLines[], evidencePackets[]. We project each item's
 *      confidence onto a representative field using a canonical label
 *      (e.g. `claims[0].claim`, `formulaLines[2].ai`, `evidencePackets[1].keyTakeaway`)
 *      so dedup + routing stay stable across re-imports of the same document.
 */
function* walkConfidenceScores(extraction) {
  // Shape 1: explicit perField map.
  const perField = extraction?.confidence?.perField;
  if (perField && typeof perField === 'object') {
    for (const [field, score] of Object.entries(perField)) {
      if (typeof score === 'number') yield { field, score };
    }
  }

  // Shape 2: per-item confidence on arrays.
  const claims = Array.isArray(extraction?.claims) ? extraction.claims : [];
  for (let i = 0; i < claims.length; i++) {
    const c = claims[i];
    if (typeof c?.confidence === 'number') {
      const label = c.claim ? `claims[${i}].claim` : `claims[${i}]`;
      yield { field: label, score: c.confidence };
    }
  }

  const formulaLines = Array.isArray(extraction?.formulaLines) ? extraction.formulaLines : [];
  for (let i = 0; i < formulaLines.length; i++) {
    const f = formulaLines[i];
    if (typeof f?.confidence === 'number') {
      const label = (f.ai || f.aiForm || f.fmPlm) ? `formulaLines[${i}].ai` : `formulaLines[${i}]`;
      yield { field: label, score: f.confidence };
    }
  }

  const packets = Array.isArray(extraction?.evidencePackets) ? extraction.evidencePackets : [];
  for (let i = 0; i < packets.length; i++) {
    const p = packets[i];
    if (typeof p?.confidence === 'number') {
      yield { field: `evidencePackets[${i}].keyTakeaway`, score: p.confidence };
    }
  }
}

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Generate validation requests for a freshly committed extraction.
 * Best-effort: individual upsert failures are logged and swallowed so one
 * broken row does not prevent the rest of the queue from being written.
 *
 * @param {object} args
 * @param {string} args.documentId      PCS Document page id (required).
 * @param {string} [args.versionId]     PCS Version page id.
 * @param {string} [args.pcsId]         Human-readable PCS ID (e.g. "PCS-0126") for titles.
 * @param {object} [args.extraction]    Full extraction JSON from extractFromPdf().
 * @param {string|null} [args.templateVersion] Classifier output.
 * @param {{positive:string[], negative:string[]}|null} [args.templateSignals]
 * @returns {Promise<{ created: number, updated: number, skipped: number, errors: number }>}
 */
export async function generateValidationRequests({
  documentId,
  versionId = null,
  pcsId = null,
  extraction = null,
  templateVersion = null,
  templateSignals = null,
}) {
  const stats = { created: 0, updated: 0, skipped: 0, errors: 0 };
  if (!documentId) return stats;

  const threshold = getConfidenceThreshold();
  const displayPcsId = pcsId || documentId.slice(0, 8);

  // ── Loop A: confidence-based low-confidence requests ──
  for (const { field, score } of walkConfidenceScores(extraction || {})) {
    if (score >= threshold) continue;
    const role = routeFieldToRole(field);
    const priority = /claim|safety/i.test(field) ? 'High' : 'Normal';
    try {
      const res = await upsertRequest({
        documentId,
        versionId,
        type: 'low-confidence',
        specificField: field,
        title: `Low-confidence extraction: ${field} on ${displayPcsId}`,
        notes: `Field "${field}" extracted with confidence ${(score * 100).toFixed(0)}% (threshold: ${(threshold * 100).toFixed(0)}%). Manual verification required.`,
        assignedRole: role,
        priority,
        source: 'auto-on-commit',
      });
      stats[res.action] = (stats[res.action] || 0) + 1;
    } catch (err) {
      stats.errors += 1;
      console.warn(`[REQUEST-GEN] upsert failed for low-confidence "${field}":`, err?.message || err);
    }
  }

  // ── Loop B: template-version drift ──
  if (templateVersion && templateVersion !== 'Lauren v1.0' && templateVersion !== 'Unknown') {
    const isLegacy = templateVersion === 'Legacy pre-Lauren';
    const missingSignals = (templateSignals?.negative ?? []).join('; ');
    const notes = [
      `Template classified as "${templateVersion}".`,
      missingSignals ? `Missing signals: ${missingSignals}` : '',
      isLegacy ? 'This document predates the Lauren v1.0 template and should be re-issued.' : '',
    ].filter(Boolean).join('\n');
    try {
      const res = await upsertRequest({
        documentId,
        versionId,
        type: 'template-drift',
        specificField: 'template-version',
        title: `Template drift: ${templateVersion} — ${displayPcsId}`,
        notes,
        assignedRole: 'Template-owner',
        priority: isLegacy ? 'High' : 'Normal',
        source: 'auto-on-commit',
      });
      stats[res.action] = (stats[res.action] || 0) + 1;
    } catch (err) {
      stats.errors += 1;
      console.warn('[REQUEST-GEN] upsert failed for template-drift:', err?.message || err);
    }
  }

  return stats;
}
