/**
 * PCS Benefit Categories CRUD — Postgres-first as of Tier-2 PR #7 (2026-05-23).
 *
 * Hierarchical taxonomy of benefit categories (Brain / cognition / mood,
 * Cardiovascular, Sleep, etc.). Self-referential parent_category_id via
 * notion_page_id supports nested subcategories.
 *
 * Storage: `pcs_benefit_categories` Supabase table (migration 016).
 * Notion mirror fire-and-forget.
 */

import { getPcsSupabase } from './supabase-pcs.js';

function parsePostgresRow(row) {
  return {
    id: row.notion_page_id || row.id,
    name: row.name || '',
    parentCategoryId: row.parent_category_id || null,
    displayOrder: row.display_order ?? null,
    icon: row.icon || '',
    notes: row.notes || '',
    createdTime: row.notion_created_at || null,
    lastEditedTime: row.notion_last_edited_at || null,
  };
}

function buildRow(fields) {
  const row = {};
  if (fields.name !== undefined) row.name = fields.name || '';
  if (fields.parentCategoryId !== undefined) row.parent_category_id = fields.parentCategoryId || null;
  if (fields.displayOrder !== undefined) row.display_order = fields.displayOrder ?? null;
  if (fields.icon !== undefined) row.icon = fields.icon || '';
  if (fields.notes !== undefined) row.notes = fields.notes || '';
  return row;
}

// ─── Reads ──────────────────────────────────────────────────────────────

export async function getAllBenefitCategories() {
  const sb = getPcsSupabase();
  if (!sb) throw new Error('Supabase not configured');
  const { data, error } = await sb
    .from('pcs_benefit_categories')
    .select('*')
    .order('display_order', { ascending: true, nullsFirst: false });
  if (error) throw new Error(`Benefit categories read failed: ${error.message}`);
  return (data || []).map(parsePostgresRow);
}

export async function getBenefitCategory(id) {
  const sb = getPcsSupabase();
  if (!sb) throw new Error('Supabase not configured');
  const { data, error } = await sb
    .from('pcs_benefit_categories')
    .select('*')
    .eq('notion_page_id', id)
    .maybeSingle();
  if (error) throw new Error(`Benefit category read failed: ${error.message}`);
  return data ? parsePostgresRow(data) : null;
}

export async function getChildren(parentId) {
  const sb = getPcsSupabase();
  if (!sb) throw new Error('Supabase not configured');
  const { data, error } = await sb
    .from('pcs_benefit_categories')
    .select('*')
    .eq('parent_category_id', parentId)
    .order('display_order', { ascending: true, nullsFirst: false });
  if (error) throw new Error(`Benefit category children read failed: ${error.message}`);
  return (data || []).map(parsePostgresRow);
}

export async function resolveByName(name) {
  if (!name || typeof name !== 'string') return null;
  const target = name.trim().toLowerCase();
  if (!target) return null;
  const all = await getAllBenefitCategories();
  return all.find(c => c.name.trim().toLowerCase() === target) || null;
}

// ─── Writes — Postgres-first, Notion mirror fire-and-forget ─────────────

export async function createBenefitCategory(fields) {
  const sb = getPcsSupabase();
  if (!sb) throw new Error('Supabase not configured');

  const row = buildRow(fields);
  const newId = crypto.randomUUID();
  row.notion_page_id = newId;
  row.notion_created_at = new Date().toISOString();
  row.notion_last_edited_at = row.notion_created_at;

  const { data, error } = await sb
    .from('pcs_benefit_categories')
    .insert(row)
    .select('*')
    .single();
  if (error) throw new Error(`Benefit category insert failed: ${error.message}`);

  return parsePostgresRow(data);
}

export async function updateBenefitCategory(id, fields) {
  const sb = getPcsSupabase();
  if (!sb) throw new Error('Supabase not configured');

  const row = buildRow(fields);
  row.notion_last_edited_at = new Date().toISOString();

  const { data, error } = await sb
    .from('pcs_benefit_categories')
    .update(row)
    .eq('notion_page_id', id)
    .select('*')
    .single();
  if (error) throw new Error(`Benefit category update failed: ${error.message}`);

  return parsePostgresRow(data);
}

export async function deleteBenefitCategory(id) {
  const sb = getPcsSupabase();
  if (!sb) throw new Error('Supabase not configured');

  const { error } = await sb
    .from('pcs_benefit_categories')
    .delete()
    .eq('notion_page_id', id);
  if (error) throw new Error(`Benefit category delete failed: ${error.message}`);
}
