/**
 * Compliance Attributes — Budget C Marketing Intelligence Layer (2026-06-14)
 *
 * Per-ingredient compliance certification tracking.
 * Data is stored in the `compliance_attributes` Supabase table (migration 021).
 *
 * Attributes represent third-party certifications and regulatory compliance
 * postures that matter to Nordic's marketing and RA teams (and their customers).
 */

import { getPcsSupabase } from '@/lib/supabase-pcs';

export const COMPLIANCE_ATTRIBUTES = Object.freeze([
  'Non-GMO',
  'Vegan',
  'Vegetarian',
  'Halal',
  'Kosher',
  'WADA-Compliant',
  'Gluten-Free',
  'Soy-Free',
  'Dairy-Free',
  'Heavy-Metals-Tested',
  'Pesticide-Tested',
  'Prop65-Compliant',
  'NSF-Certified',
  'USP-Verified',
  'CCOF-Organic',
]);

export const COMPLIANCE_STATUS_LABEL = Object.freeze({
  yes:         'Yes',
  no:          'No',
  conditional: 'Conditional',
  unknown:     'Unknown',
});

function parseRow(row) {
  return {
    id:          row.id,
    ingredientId: row.ingredient_id,
    attribute:   row.attribute,
    status:      row.status,
    certifiedBy: row.certified_by || null,
    notes:       row.notes || null,
    updatedAt:   row.updated_at || null,
  };
}

/**
 * Fetch all compliance attribute records for an ingredient.
 * Returns a map: attribute → record, filled with `unknown` defaults for
 * attributes not yet set so the UI always renders all 15 rows.
 *
 * @param {string} ingredientId — notion_page_id of the ingredient
 * @returns {Promise<Record<string, { status, certifiedBy, notes, updatedAt }>>}
 */
export async function getComplianceAttributes(ingredientId) {
  const sb = getPcsSupabase();
  const { data, error } = await sb
    .from('compliance_attributes')
    .select('*')
    .eq('ingredient_id', ingredientId);

  if (error) throw error;

  const byAttr = {};
  for (const attr of COMPLIANCE_ATTRIBUTES) {
    byAttr[attr] = { status: 'unknown', certifiedBy: null, notes: null, updatedAt: null };
  }
  for (const row of (data || [])) {
    byAttr[row.attribute] = parseRow(row);
  }
  return byAttr;
}

/**
 * Upsert a single compliance attribute for an ingredient.
 * Uses the unique index on (ingredient_id, attribute) for conflict resolution.
 *
 * @param {string} ingredientId
 * @param {string} attribute — must be in COMPLIANCE_ATTRIBUTES
 * @param {{ status: string, certifiedBy?: string, notes?: string }} fields
 */
export async function upsertComplianceAttribute(ingredientId, attribute, fields) {
  if (!COMPLIANCE_ATTRIBUTES.includes(attribute)) {
    throw new Error(`Unknown compliance attribute: ${attribute}`);
  }
  const sb = getPcsSupabase();
  const { data, error } = await sb
    .from('compliance_attributes')
    .upsert(
      {
        ingredient_id: ingredientId,
        attribute,
        status:       fields.status || 'unknown',
        certified_by: fields.certifiedBy || null,
        notes:        fields.notes || null,
        updated_at:   new Date().toISOString(),
      },
      { onConflict: 'ingredient_id,attribute' }
    )
    .select()
    .single();

  if (error) throw error;
  return parseRow(data);
}
