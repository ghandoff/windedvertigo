// One-shot diagnostic: are the PCS tables present in wv-nordic Supabase?
// Run with: node --env-file=apps/nordic-sqr-rct/.env.local /tmp/check-supabase-tables.mjs
import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_NORDIC_URL;
const key = process.env.SUPABASE_NORDIC_SERVICE_ROLE_KEY
  || process.env.SUPABASE_NORDIC_ANON_KEY;

if (!url || !key) {
  console.error('Missing SUPABASE_NORDIC_URL or key');
  process.exit(1);
}

const sb = createClient(url, key, { auth: { persistSession: false } });

const tables = [
  'reviewers', 'intakes', 'scores',
  'pcs_documents', 'pcs_versions', 'pcs_claims', 'pcs_evidence',
  'pcs_evidence_packets', 'pcs_canonical_claims', 'pcs_formula_lines',
  'pcs_references', 'pcs_wording_variants', 'pcs_requests',
  'pcs_revision_events', 'pcs_schema_intake',
  'cv_active_ingredients', 'cv_format_codes',
  'score_reviewers', 'version_claims', 'packet_evidence', 'evidence_references',
];

const results = [];
for (const t of tables) {
  try {
    const { count, error } = await sb.from(t).select('*', { count: 'exact', head: true });
    results.push({ table: t, exists: !error, count: count ?? null, error: error?.message });
  } catch (err) {
    results.push({ table: t, exists: false, count: null, error: err.message });
  }
}

console.log(JSON.stringify(results, null, 2));
