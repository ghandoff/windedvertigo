/**
 * POST /api/admin/controlled-vocab/import
 * Capability: pcs.taxonomy:edit  (researcher / admin / super-user)
 *
 * Accepts a CSV file uploaded as multipart/form-data and upserts rows into
 * one of the supported cv_* tables. Idempotent — safe to re-upload as the
 * vocabulary evolves.
 *
 * Form fields:
 *   file  — CSV file
 *   table — one of: "cv_active_ingredients" | "cv_claim_prefixes"
 *
 * CSV column expectations by table:
 *   cv_active_ingredients: ai_name (required), display_name, ai_class
 *   cv_claim_prefixes:     prefix_text (required)
 *
 * Returns: { ok: true, inserted: N, updated: N, skipped: N, errors: [...] }
 */

import { NextResponse } from 'next/server';
import { requireCapability } from '@/lib/auth/require-capability';
import { getPcsSupabase } from '@/lib/supabase-pcs';

export const dynamic = 'force-dynamic';

const SUPPORTED_TABLES = new Set(['cv_active_ingredients', 'cv_claim_prefixes']);

function parseCsv(text) {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return { headers: [], rows: [] };
  const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/^"|"$/g, ''));
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = lines[i].split(',').map(c => c.trim().replace(/^"|"$/g, ''));
    if (cells.every(c => !c)) continue;
    const row = {};
    headers.forEach((h, j) => { row[h] = cells[j] ?? ''; });
    rows.push(row);
  }
  return { headers, rows };
}

function buildUpsertRow(tableName, csvRow) {
  if (tableName === 'cv_active_ingredients') {
    const aiName = (csvRow['ai_name'] || csvRow['name'] || '').trim();
    if (!aiName) return null;
    return {
      ai_name:      aiName,
      display_name: (csvRow['display_name'] || csvRow['displayname'] || aiName).trim(),
      ai_class:     (csvRow['ai_class'] || csvRow['class'] || csvRow['category'] || '').trim() || null,
      archived:     false,
    };
  }
  if (tableName === 'cv_claim_prefixes') {
    const prefix = (csvRow['prefix_text'] || csvRow['prefix'] || '').trim();
    if (!prefix) return null;
    return {
      prefix_text: prefix,
      archived: false,
    };
  }
  return null;
}

export async function POST(request) {
  const auth = await requireCapability(request, 'pcs.taxonomy:edit', {
    route: '/api/admin/controlled-vocab/import',
  });
  if (auth.error) return auth.error;

  let formData;
  try { formData = await request.formData(); }
  catch { return NextResponse.json({ error: 'Expected multipart/form-data' }, { status: 400 }); }

  const tableName = (formData.get('table') || '').trim();
  if (!SUPPORTED_TABLES.has(tableName)) {
    return NextResponse.json(
      { error: `Unsupported table "${tableName}". Supported: ${[...SUPPORTED_TABLES].join(', ')}` },
      { status: 400 }
    );
  }

  const file = formData.get('file');
  if (!file || typeof file.text !== 'function') {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 });
  }

  const text = await file.text();
  const { rows } = parseCsv(text);
  if (rows.length === 0) {
    return NextResponse.json({ ok: true, inserted: 0, updated: 0, skipped: 0, errors: [] });
  }

  const upsertRows = [];
  const skippedRows = [];
  for (const row of rows) {
    const built = buildUpsertRow(tableName, row);
    if (built) upsertRows.push(built);
    else skippedRows.push(row);
  }

  if (upsertRows.length === 0) {
    return NextResponse.json({ ok: true, inserted: 0, updated: 0, skipped: rows.length, errors: [] });
  }

  const conflictColumn = tableName === 'cv_active_ingredients' ? 'ai_name' : 'prefix_text';

  const sb = getPcsSupabase();
  const { data, error } = await sb
    .from(tableName)
    .upsert(upsertRows, { onConflict: conflictColumn, ignoreDuplicates: false })
    .select('id');

  if (error) {
    console.error('[controlled-vocab/import] upsert failed:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    upserted: data?.length ?? upsertRows.length,
    skipped: skippedRows.length,
    errors: [],
  });
}
