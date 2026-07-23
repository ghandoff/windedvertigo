/**
 * Label Intake Queue CRUD — Postgres-first as of Tier-2 PR #8 (2026-05-23).
 *
 * Rows flow through:
 *   Pending → Extracting → (Needs Validation | Committed | Failed | Cancelled)
 *
 * Mirrors the shape of src/lib/pcs-import-jobs.js, trimmed to the fields the
 * label-extraction path needs. The full Claude Vision extraction JSON is
 * stored as plain TEXT (Notion's 2000-char chunking is unnecessary in PG).
 *
 * Storage: `label_intake_queue` Supabase table (migration 017). Notion is
 * mirrored fire-and-forget for legacy view continuity.
 */

import { PROPS } from './pcs-config.js';
import { getPcsSupabase } from './supabase-pcs.js';

const Q = PROPS.labelIntakeQueue;

function fromRichText(richText) {
  return (richText || []).map(t => t.plain_text || t.text?.content || '').join('');
}

// ─── Parse ──────────────────────────────────────────────────────────────

function parsePostgresRow(row) {
  return {
    id: row.notion_page_id || row.id,
    sku: row.sku || '',
    pcsId: row.pcs_id || '',
    productName: row.product_name || '',
    files: row.files || [],
    dateReceived: row.date_received || null,
    market: row.market || '',
    regulatory: row.regulatory || null,
    ingested: row.ingested || false,
    ingestedLabelId: row.ingested_label_id || null,
    notes: row.notes || '',
    status: row.status || null,
    contentHash: row.content_hash || '',
    extractionData: row.extraction_data || '',
    error: row.error || '',
    retryCount: row.retry_count ?? 0,
    promptVersion: row.prompt_version || '',
    batchId: row.batch_id || '',
    confidenceOverall: row.confidence_overall ?? null,
    ownerEmail: row.owner_email || null,
    createdTime: row.notion_created_at || null,
    lastEditedTime: row.notion_last_edited_at || null,
  };
}

export function parseQueueRow(page) {
  const p = page.properties;
  return {
    id: page.id,
    sku: p[Q.sku]?.title?.[0]?.plain_text || '',
    pcsId: (p[Q.pcsId]?.rich_text || []).map(t => t.plain_text).join(''),
    productName: (p[Q.productName]?.rich_text || []).map(t => t.plain_text).join(''),
    files: (p[Q.labelFile]?.files || []).map(f => ({
      name: f.name,
      url: f.external?.url || f.file?.url || null,
      external: f.external,
      file: f.file,
    })),
    dateReceived: p[Q.dateReceived]?.date?.start || null,
    market: (p[Q.market]?.rich_text || []).map(t => t.plain_text).join(''),
    regulatory: p[Q.regulatory]?.select?.name || null,
    ingested: p[Q.ingested]?.checkbox || false,
    ingestedLabelId: (p[Q.ingestedLabel]?.relation || [])[0]?.id || null,
    notes: (p[Q.notes]?.rich_text || []).map(t => t.plain_text).join(''),
    status: p[Q.status]?.select?.name || null,
    contentHash: (p[Q.contentHash]?.rich_text || []).map(t => t.plain_text).join(''),
    extractionData: fromRichText(p[Q.extractionData]?.rich_text),
    error: (p[Q.error]?.rich_text || []).map(t => t.plain_text).join(''),
    retryCount: p[Q.retryCount]?.number ?? 0,
    promptVersion: (p[Q.promptVersion]?.rich_text || []).map(t => t.plain_text).join(''),
    batchId: (p[Q.batchId]?.rich_text || []).map(t => t.plain_text).join(''),
    confidenceOverall: p[Q.confidenceOverall]?.number ?? null,
    ownerEmail: p[Q.ownerEmail]?.email || null,
    createdTime: page.created_time,
    lastEditedTime: page.last_edited_time,
  };
}

// ─── Row builder ────────────────────────────────────────────────────────

function buildRow(fields) {
  const row = {};
  if (fields.sku !== undefined) row.sku = fields.sku || '';
  if (fields.pcsId !== undefined) row.pcs_id = fields.pcsId || null;
  if (fields.productName !== undefined) row.product_name = fields.productName || null;
  if (fields.files !== undefined) row.files = fields.files || [];
  if (fields.dateReceived !== undefined) row.date_received = fields.dateReceived || null;
  if (fields.market !== undefined) row.market = fields.market || null;
  if (fields.regulatory !== undefined) row.regulatory = fields.regulatory || null;
  if (fields.status !== undefined) row.status = fields.status || null;
  if (fields.retryCount !== undefined) row.retry_count = fields.retryCount ?? 0;
  if (fields.promptVersion !== undefined) row.prompt_version = fields.promptVersion || null;
  if (fields.batchId !== undefined) row.batch_id = fields.batchId || null;
  if (fields.ownerEmail !== undefined) row.owner_email = fields.ownerEmail || null;
  if (fields.ingested !== undefined) row.ingested = !!fields.ingested;
  if (fields.ingestedLabelId !== undefined) row.ingested_label_id = fields.ingestedLabelId || null;
  if (fields.contentHash !== undefined) row.content_hash = fields.contentHash || null;
  if (fields.extractionData !== undefined) row.extraction_data = fields.extractionData || null;
  if (fields.error !== undefined) row.error = fields.error || null;
  if (fields.confidenceOverall !== undefined) row.confidence_overall = fields.confidenceOverall ?? null;
  if (fields.notes !== undefined) row.notes = fields.notes || null;
  return row;
}

// ─── Reads ──────────────────────────────────────────────────────────────

export async function getAllIntakeRows(maxPages = 20) {
  const sb = getPcsSupabase();
  if (!sb) throw new Error('Supabase not configured');
  const { data, error } = await sb
    .from('label_intake_queue')
    .select('*')
    .order('notion_created_at', { ascending: false, nullsFirst: false })
    .limit(maxPages * 100);
  if (error) throw new Error(`Intake rows read failed: ${error.message}`);
  return (data || []).map(parsePostgresRow);
}

export async function getIntakeRow(id) {
  const sb = getPcsSupabase();
  if (!sb) throw new Error('Supabase not configured');
  const { data, error } = await sb
    .from('label_intake_queue')
    .select('*')
    .eq('notion_page_id', id)
    .maybeSingle();
  if (error) throw new Error(`Intake row read failed: ${error.message}`);
  return data ? parsePostgresRow(data) : null;
}

export async function getIntakeRowsByStatus(status, limit = 10) {
  const sb = getPcsSupabase();
  if (!sb) throw new Error('Supabase not configured');
  const { data, error } = await sb
    .from('label_intake_queue')
    .select('*')
    .eq('status', status)
    .order('notion_created_at', { ascending: true, nullsFirst: false })
    .limit(Math.min(limit, 100));
  if (error) throw new Error(`Intake rows read failed: ${error.message}`);
  return (data || []).map(parsePostgresRow);
}

export async function getIntakeRowsByBatch(batchId) {
  const sb = getPcsSupabase();
  if (!sb) throw new Error('Supabase not configured');
  const { data, error } = await sb
    .from('label_intake_queue')
    .select('*')
    .eq('batch_id', batchId)
    .order('notion_created_at', { ascending: true, nullsFirst: false });
  if (error) throw new Error(`Intake rows read failed: ${error.message}`);
  return (data || []).map(parsePostgresRow);
}

export async function getStaleIntakeRows(status, olderThan, limit = 10) {
  const sb = getPcsSupabase();
  if (!sb) throw new Error('Supabase not configured');
  const { data, error } = await sb
    .from('label_intake_queue')
    .select('*')
    .eq('status', status)
    .lt('notion_last_edited_at', olderThan.toISOString())
    .order('notion_last_edited_at', { ascending: true, nullsFirst: false })
    .limit(Math.min(limit, 100));
  if (error) throw new Error(`Intake rows read failed: ${error.message}`);
  return (data || []).map(parsePostgresRow);
}

export async function getIntakeRowByContentHash(hash) {
  if (!hash) return null;
  const sb = getPcsSupabase();
  if (!sb) throw new Error('Supabase not configured');
  const { data, error } = await sb
    .from('label_intake_queue')
    .select('*')
    .eq('content_hash', hash)
    .neq('status', 'Cancelled')
    .order('notion_created_at', { ascending: false, nullsFirst: false })
    .limit(5);
  if (error) throw new Error(`Intake row read failed: ${error.message}`);
  return data?.length ? parsePostgresRow(data[0]) : null;
}

// ─── Writes ─────────────────────────────────────────────────────────────

export async function createIntakeRow(args) {
  const {
    sku = '', pcsId = null, productName = null, labelFile,
    batchId, ownerEmail = null, contentHash = null,
    regulatory = null, market = null, notes = null,
    initialStatus = 'Pending', error = null,
  } = args;

  if (!labelFile || !labelFile.url) {
    throw new Error('createIntakeRow: labelFile.url is required');
  }

  const sb = getPcsSupabase();
  if (!sb) throw new Error('Supabase not configured');

  const newId = crypto.randomUUID();
  const now = new Date().toISOString();
  const effectiveSku = sku || `LABEL-${batchId || 'UNK'}-${Math.random().toString(36).slice(2, 6)}`;

  const row = {
    notion_page_id: newId,
    sku: effectiveSku,
    pcs_id: pcsId,
    product_name: productName,
    files: [{ name: labelFile.name || 'label', url: labelFile.url }],
    date_received: now.slice(0, 10),
    market,
    regulatory,
    status: initialStatus,
    retry_count: 0,
    batch_id: batchId || null,
    owner_email: ownerEmail,
    content_hash: contentHash,
    error,
    notes,
    ingested: false,
    notion_created_at: now,
    notion_last_edited_at: now,
  };

  const { data, error: insertErr } = await sb
    .from('label_intake_queue')
    .insert(row)
    .select('*')
    .single();
  if (insertErr) throw new Error(`Intake row insert failed: ${insertErr.message}`);

  return parsePostgresRow(data);
}

export async function updateIntakeRow(id, fields) {
  const sb = getPcsSupabase();
  if (!sb) throw new Error('Supabase not configured');

  const row = buildRow(fields);
  row.notion_last_edited_at = new Date().toISOString();

  const { data, error } = await sb
    .from('label_intake_queue')
    .update(row)
    .eq('notion_page_id', id)
    .select('*')
    .single();
  if (error) throw new Error(`Intake row update failed: ${error.message}`);

  return parsePostgresRow(data);
}
