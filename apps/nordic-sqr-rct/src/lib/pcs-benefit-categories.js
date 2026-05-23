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

import { PCS_DB, PROPS } from './pcs-config.js';
import { notion } from './notion.js';
import { getPcsSupabase } from './supabase-pcs.js';

const P = PROPS.benefitCategories;

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

function parsePage(page) {
  const p = page.properties;
  return {
    id: page.id,
    name: p[P.name]?.title?.[0]?.plain_text || '',
    parentCategoryId: (p[P.parentCategory]?.relation || [])[0]?.id || null,
    displayOrder: p[P.displayOrder]?.number ?? null,
    icon: (p[P.icon]?.rich_text || []).map(t => t.plain_text).join(''),
    notes: (p[P.notes]?.rich_text || []).map(t => t.plain_text).join(''),
    createdTime: page.created_time,
    lastEditedTime: page.last_edited_time,
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

function buildProperties(fields) {
  const properties = {};
  if (fields.name !== undefined) properties[P.name] = { title: [{ text: { content: fields.name || '' } }] };
  if (fields.parentCategoryId !== undefined) properties[P.parentCategory] = fields.parentCategoryId ? { relation: [{ id: fields.parentCategoryId }] } : { relation: [] };
  if (fields.displayOrder !== undefined) properties[P.displayOrder] = { number: fields.displayOrder };
  if (fields.icon !== undefined) properties[P.icon] = { rich_text: [{ text: { content: fields.icon || '' } }] };
  if (fields.notes !== undefined) properties[P.notes] = { rich_text: [{ text: { content: fields.notes || '' } }] };
  return properties;
}

// ─── Reads ──────────────────────────────────────────────────────────────

export async function getAllBenefitCategories() {
  const sb = getPcsSupabase();
  if (sb) {
    const { data, error } = await sb
      .from('pcs_benefit_categories')
      .select('*')
      .order('display_order', { ascending: true, nullsFirst: false });
    if (!error) return (data || []).map(parsePostgresRow);
  }
  let all = [];
  let cursor;
  do {
    const res = await notion.databases.query({
      database_id: PCS_DB.benefitCategories,
      page_size: 100,
      start_cursor: cursor,
      sorts: [{ property: P.displayOrder, direction: 'ascending' }],
    });
    all = all.concat(res.results);
    cursor = res.has_more ? res.next_cursor : undefined;
  } while (cursor);
  return all.map(parsePage);
}

export async function getBenefitCategory(id) {
  const sb = getPcsSupabase();
  if (sb) {
    const { data, error } = await sb
      .from('pcs_benefit_categories')
      .select('*')
      .eq('notion_page_id', id)
      .maybeSingle();
    if (!error && data) return parsePostgresRow(data);
  }
  const page = await notion.pages.retrieve({ page_id: id });
  return parsePage(page);
}

export async function getChildren(parentId) {
  const sb = getPcsSupabase();
  if (sb) {
    const { data, error } = await sb
      .from('pcs_benefit_categories')
      .select('*')
      .eq('parent_category_id', parentId)
      .order('display_order', { ascending: true, nullsFirst: false });
    if (!error) return (data || []).map(parsePostgresRow);
  }
  const res = await notion.databases.query({
    database_id: PCS_DB.benefitCategories,
    filter: { property: P.parentCategory, relation: { contains: parentId } },
    sorts: [{ property: P.displayOrder, direction: 'ascending' }],
  });
  return res.results.map(parsePage);
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

  notion.pages
    .create({ parent: { database_id: PCS_DB.benefitCategories }, properties: buildProperties(fields) })
    .catch(() => { /* Part 10 — Notion no longer canonical */ });

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

  notion.pages
    .update({ page_id: id, properties: buildProperties(fields) })
    .catch(() => { /* Part 10 — Notion no longer canonical */ });

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

  notion.pages
    .update({ page_id: id, archived: true })
    .catch(() => { /* Part 10 — Notion no longer canonical */ });
}
