/**
 * Product Labels CRUD (Wave 5.0; Postgres-first as of Part 10 PR #5, 2026-05-23).
 *
 * Product Labels are the market-facing substantiation anchor: every SKU
 * ships a label, and the label is what the regulator, consumer, and
 * plaintiff attorney actually read. Labels relate to PCS Documents
 * (substantiation), Ingredients (printed composition), Evidence Library
 * (safety cross-check), and PCS Requests (drift findings).
 *
 * Storage: `pcs_labels` Supabase table (migration 014). Notion is mirrored
 * fire-and-forget for legacy view continuity; never blocks the platform.
 *
 * See docs/plans/wave-5-product-labels.md §2 for the original property schema.
 */

import { PROPS } from './pcs-config.js';
import { getPcsSupabase } from './supabase-pcs.js';

const P = PROPS.productLabels;

// ─── Parse ───────────────────────────────────────────────────────────────

/** Public shape from a pcs_labels Postgres row. */
function parsePostgresRow(row) {
  return {
    id: row.notion_page_id || row.id,
    sku: row.sku || '',
    upc: row.upc || '',
    productNameAsMarketed: row.product_name_as_marketed || '',
    labelImage: row.label_image || [],
    labelVersionDate: row.label_version_date || null,
    regulatoryFramework: row.regulatory_framework || null,
    markets: row.markets || [],
    approvedClaimsOnLabel: row.approved_claims_on_label || '',
    ingredientListIds: row.ingredient_list_ids || [],
    ingredientDoses: row.ingredient_doses || '',
    dvCompliance: row.dv_compliance || false,
    pcsDocumentId: row.pcs_document_id || null,
    linkedEvidenceIds: row.linked_evidence_ids || [],
    status: row.status || null,
    lastDriftCheck: row.last_drift_check || null,
    driftFindingIds: row.drift_finding_ids || [],
    ownerIds: row.owner_ids || [],
    notes: row.notes || '',
    createdTime: row.notion_created_at || null,
    lastEditedTime: row.notion_last_edited_at || null,
  };
}

/** Public shape from a Notion page (legacy fallback). */
export function parsePage(page) {
  const p = page.properties;
  return {
    id: page.id,
    sku: p[P.sku]?.title?.[0]?.plain_text || '',
    upc: (p[P.upc]?.rich_text || []).map(t => t.plain_text).join(''),
    productNameAsMarketed: (p[P.productNameAsMarketed]?.rich_text || []).map(t => t.plain_text).join(''),
    labelImage: (p[P.labelImage]?.files || []).map(f => ({
      name: f.name,
      url: f.external?.url || f.file?.url || null,
    })),
    labelVersionDate: p[P.labelVersionDate]?.date?.start || null,
    regulatoryFramework: p[P.regulatoryFramework]?.select?.name || null,
    markets: (p[P.markets]?.multi_select || []).map(s => s.name),
    approvedClaimsOnLabel: (p[P.approvedClaimsOnLabel]?.rich_text || []).map(t => t.plain_text).join(''),
    ingredientListIds: (p[P.ingredientList]?.relation || []).map(r => r.id),
    ingredientDoses: (p[P.ingredientDoses]?.rich_text || []).map(t => t.plain_text).join(''),
    dvCompliance: p[P.dvCompliance]?.checkbox || false,
    pcsDocumentId: (p[P.pcsDocument]?.relation || [])[0]?.id || null,
    linkedEvidenceIds: (p[P.linkedEvidence]?.relation || []).map(r => r.id),
    status: p[P.status]?.select?.name || null,
    lastDriftCheck: p[P.lastDriftCheck]?.date?.start || null,
    driftFindingIds: (p[P.driftFindings]?.relation || []).map(r => r.id),
    ownerIds: (p[P.owner]?.people || []).map(u => u.id),
    notes: (p[P.notes]?.rich_text || []).map(t => t.plain_text).join(''),
    createdTime: page.created_time,
    lastEditedTime: page.last_edited_time,
  };
}

// ─── Row builder (camelCase fields → snake_case columns) ─────────────────

function buildRow(fields) {
  const row = {};
  if (fields.sku !== undefined) row.sku = fields.sku || '';
  if (fields.upc !== undefined) row.upc = fields.upc || '';
  if (fields.productNameAsMarketed !== undefined) row.product_name_as_marketed = fields.productNameAsMarketed || '';
  if (fields.labelImage !== undefined) {
    row.label_image = (fields.labelImage || []).map(f => ({
      name: f.name || 'label',
      url: f.external?.url || f.url || null,
    }));
  }
  if (fields.labelVersionDate !== undefined) row.label_version_date = fields.labelVersionDate || null;
  if (fields.regulatoryFramework !== undefined) row.regulatory_framework = fields.regulatoryFramework || null;
  if (fields.markets !== undefined) row.markets = fields.markets || [];
  if (fields.approvedClaimsOnLabel !== undefined) row.approved_claims_on_label = fields.approvedClaimsOnLabel || '';
  if (fields.ingredientListIds !== undefined) row.ingredient_list_ids = fields.ingredientListIds || [];
  if (fields.ingredientDoses !== undefined) row.ingredient_doses = fields.ingredientDoses || '';
  if (fields.dvCompliance !== undefined) row.dv_compliance = !!fields.dvCompliance;
  if (fields.pcsDocumentId !== undefined) row.pcs_document_id = fields.pcsDocumentId || null;
  if (fields.linkedEvidenceIds !== undefined) row.linked_evidence_ids = fields.linkedEvidenceIds || [];
  if (fields.status !== undefined) row.status = fields.status || null;
  if (fields.lastDriftCheck !== undefined) row.last_drift_check = fields.lastDriftCheck || null;
  if (fields.driftFindingIds !== undefined) row.drift_finding_ids = fields.driftFindingIds || [];
  if (fields.ownerIds !== undefined) row.owner_ids = fields.ownerIds || [];
  if (fields.notes !== undefined) row.notes = fields.notes || '';
  return row;
}

// ─── Reads ───────────────────────────────────────────────────────────────

export async function getAllLabels(maxPages = 50) {
  const sb = getPcsSupabase();
  if (sb) {
    const { data, error } = await sb
      .from('pcs_labels')
      .select('*')
      .order('sku', { ascending: true })
      .limit(maxPages * 100);
    if (!error) return (data || []).map(parsePostgresRow);
    console.warn('[pcs-labels] Postgres read failed:', error.message);
  }
  return [];
}

export async function getLabel(id) {
  const sb = getPcsSupabase();
  if (sb) {
    const { data, error } = await sb
      .from('pcs_labels')
      .select('*')
      .eq('notion_page_id', id)
      .maybeSingle();
    if (!error && data) return parsePostgresRow(data);
  }
  return null;
}

export async function getLabelsForPcs(pcsId) {
  const sb = getPcsSupabase();
  if (sb) {
    const { data, error } = await sb
      .from('pcs_labels')
      .select('*')
      .eq('pcs_document_id', pcsId)
      .order('sku', { ascending: true });
    if (!error) return (data || []).map(parsePostgresRow);
  }
  return [];
}

export async function getLabelsForIngredient(ingredientId) {
  const sb = getPcsSupabase();
  if (sb) {
    // Postgres array containment: ingredient_list_ids @> ARRAY[ingredientId]
    const { data, error } = await sb
      .from('pcs_labels')
      .select('*')
      .contains('ingredient_list_ids', [ingredientId])
      .order('sku', { ascending: true });
    if (!error) return (data || []).map(parsePostgresRow);
  }
  return [];
}

// ─── Writes — Postgres canonical, Notion mirror fire-and-forget ──────────

export async function createLabel(fields) {
  if (!fields.sku) throw new Error('createLabel: sku is required');

  const row = buildRow(fields);
  const newId = crypto.randomUUID();
  row.notion_page_id = newId;
  row.notion_created_at = new Date().toISOString();
  row.notion_last_edited_at = row.notion_created_at;

  const sb = getPcsSupabase();
  if (!sb) throw new Error('Supabase not configured');

  const { data, error } = await sb
    .from('pcs_labels')
    .insert(row)
    .select('*')
    .single();
  if (error) throw new Error(`Label insert failed: ${error.message}`);

  const parsed = parsePostgresRow(data);
  // Wave 5.2 — queue label-drift detection on create. Best-effort; never throws.
  if (parsed.pcsDocumentId) scheduleLabelDrift(parsed.id, 'create');
  return parsed;
}

export async function updateLabel(id, fields) {
  const row = buildRow(fields);
  row.notion_last_edited_at = new Date().toISOString();

  const sb = getPcsSupabase();
  if (!sb) throw new Error('Supabase not configured');

  const { data, error } = await sb
    .from('pcs_labels')
    .update(row)
    .eq('notion_page_id', id)
    .select('*')
    .single();
  if (error) throw new Error(`Label update failed: ${error.message}`);

  const parsed = parsePostgresRow(data);
  // Wave 5.2 — only re-check drift when claims, ingredients, doses, or the
  // backing PCS changed. Skips drift-stamp updates to avoid infinite loops.
  const driftRelevant = (
    fields.approvedClaimsOnLabel !== undefined
    || fields.ingredientListIds !== undefined
    || fields.ingredientDoses !== undefined
    || fields.pcsDocumentId !== undefined
  );
  const isDriftStampOnly = (
    fields.lastDriftCheck !== undefined || fields.driftFindingIds !== undefined
  );
  if (driftRelevant && !isDriftStampOnly && parsed.pcsDocumentId) {
    scheduleLabelDrift(parsed.id, 'update');
  }
  return parsed;
}

/**
 * Best-effort fire-and-forget drift scheduler. Runs on the next tick so the
 * caller's create/update resolves immediately; errors are logged and swallowed
 * so a drift-detection bug never fails a label write.
 */
function scheduleLabelDrift(labelId, reason) {
  queueMicrotask(async () => {
    try {
      const { detectDriftForLabel } = await import('./label-drift.js');
      await detectDriftForLabel(labelId);
    } catch (err) {
      console.warn(`[LABEL-DRIFT] scheduled drift (${reason}) failed for ${labelId}:`, err?.message || err);
    }
  });
}
