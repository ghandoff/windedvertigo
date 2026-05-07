/**
 * Nordic Research Platform — Cloudflare Workers entry point.
 *
 * Phase C exploratory scaffold (2026-05-06). Connects to the same
 * `wv-nordic` Supabase project the Vercel app uses and exposes a tiny
 * read-only surface to validate the supabase-from-CF-Workers path.
 *
 * Phase D (not yet) will:
 *   - Port the full Next.js app via OpenNext
 *   - Wire up the custom route in wrangler.jsonc
 *   - Cut DNS over from Vercel
 *   - Mirror the Vercel app's `requireCapability` auth pattern
 *
 * Sibling: ../nordic-sqr-rct/ (the Vercel app) — canonical until
 * Phase D ships. Don't share code across apps yet; copy-paste the
 * parsePostgresRow shape inline below so this worker can evolve
 * independently while we validate the architecture.
 */

import { Hono } from 'hono';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

type Env = {
  ENVIRONMENT: string;
  SUPABASE_NORDIC_URL?: string;
  SUPABASE_NORDIC_SECRET_KEY?: string;
};

const app = new Hono<{ Bindings: Env }>();

/**
 * Build a Supabase client from the worker's env bindings. CF Workers
 * pattern (env, not process.env). Returns null when env isn't wired —
 * /health/db and the data routes use that to surface a clean error
 * instead of throwing.
 */
function getSupabase(env: Env): SupabaseClient | null {
  const url = env.SUPABASE_NORDIC_URL;
  const key = env.SUPABASE_NORDIC_SECRET_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false },
    db: { schema: 'public' },
  });
}

// ── /health ─────────────────────────────────────────────────────────
// Doesn't hit DB; just confirms env is wired. Used by uptime checks
// and as a sanity ping after `wrangler deploy`.
app.get('/health', (c) => {
  return c.json({
    ok: true,
    ts: new Date().toISOString(),
    env: {
      supabase: Boolean(c.env.SUPABASE_NORDIC_URL && c.env.SUPABASE_NORDIC_SECRET_KEY),
    },
  });
});

// ── /health/db ──────────────────────────────────────────────────────
// Pings Supabase with a count query on pcs_evidence. Confirms the
// worker can reach Supabase from CF's edge runtime.
app.get('/health/db', async (c) => {
  const sb = getSupabase(c.env);
  if (!sb) {
    return c.json({ ok: false, error: 'supabase-not-configured' }, 503);
  }
  const t0 = Date.now();
  const { count, error } = await sb
    .from('pcs_evidence')
    .select('*', { count: 'exact', head: true });
  const ms = Date.now() - t0;
  if (error) {
    return c.json({ ok: false, error: error.message, ms }, 502);
  }
  return c.json({ ok: true, count: count ?? 0, ms });
});

/**
 * Convert a pcs_evidence Postgres row into the same shape the Vercel
 * app's parsePage(notionPage) returns.
 *
 * COPIED INLINE from apps/nordic-sqr-rct/src/lib/pcs-evidence.js
 * (parsePostgresRow). Phase C keeps the two copies separate on
 * purpose — this worker isn't in the pnpm workspace yet, and we
 * want to be able to evolve the CF surface without coupling to the
 * Vercel app. Phase D will consolidate once the migration is real.
 */
function parseEvidenceRow(row: Record<string, any>) {
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
  };
}

/**
 * Convert a pcs_claims Postgres row into the byte-identical shape
 * parsePage returns in the Vercel app. Same copy-inline rationale as
 * parseEvidenceRow above.
 */
function parseClaimRow(row: Record<string, any>) {
  return {
    id: row.notion_page_id,
    claim: row.claim || '',
    claimNo: row.claim_no || '',
    claimBucket: row.claim_bucket || null,
    claimStatus: row.claim_status || null,
    claimNotes: row.claim_notes || '',
    disclaimerRequired: row.disclaimer_required || false,
    minDoseMg: row.min_dose_mg ?? null,
    maxDoseMg: row.max_dose_mg ?? null,
    doseGuidanceNote: row.dose_guidance_note || '',
    pcsVersionId: row.pcs_version_id || null,
    canonicalClaimId: row.canonical_claim_id || null,
    claimPrefixId: row.claim_prefix_id || null,
    coreBenefitId: row.core_benefit_id || null,
    evidencePacketIds: row.evidence_packet_ids || [],
    wordingVariantIds: row.wording_variant_ids || [],
    heterogeneity: row.heterogeneity || null,
    publicationBias: row.publication_bias || null,
    fundingBias: row.funding_bias || null,
    precision: row.precision || null,
    effectSizeCategory: row.effect_size_category || null,
    doseResponseGradient: row.dose_response_gradient || null,
    certaintyScore: row.certainty_score ?? null,
    certaintyRating: row.certainty_rating || null,
    confidence: row.confidence ?? null,
    createdTime: row.notion_created_at,
    lastEditedTime: row.notion_last_edited_at,
  };
}

// ── /api/pcs/evidence ───────────────────────────────────────────────
// Read-only mirror of the Vercel app's evidence list endpoint. Same
// shape; data sourced exclusively from Postgres (no Notion fallback
// at the worker layer — Phase D will revisit).
app.get('/api/pcs/evidence', async (c) => {
  const sb = getSupabase(c.env);
  if (!sb) {
    return c.json({ ok: false, error: 'supabase-not-configured' }, 503);
  }
  const { data, error } = await sb
    .from('pcs_evidence')
    .select('*')
    .order('notion_last_edited_at', { ascending: false })
    .limit(2000);
  if (error) {
    return c.json({ ok: false, error: error.message }, 502);
  }
  return c.json({ ok: true, count: data?.length ?? 0, evidence: (data || []).map(parseEvidenceRow) });
});

// ── /api/pcs/claims ─────────────────────────────────────────────────
// Read-only mirror of the Vercel app's claims list endpoint.
app.get('/api/pcs/claims', async (c) => {
  const sb = getSupabase(c.env);
  if (!sb) {
    return c.json({ ok: false, error: 'supabase-not-configured' }, 503);
  }
  const { data, error } = await sb
    .from('pcs_claims')
    .select('*')
    .order('notion_last_edited_at', { ascending: false })
    .limit(2000);
  if (error) {
    return c.json({ ok: false, error: error.message }, 502);
  }
  return c.json({ ok: true, count: data?.length ?? 0, claims: (data || []).map(parseClaimRow) });
});

// ── 404 fallback ────────────────────────────────────────────────────
app.notFound((c) =>
  c.json(
    {
      ok: false,
      error: 'not-found',
      hint: 'try /health, /health/db, /api/pcs/evidence, or /api/pcs/claims',
    },
    404,
  ),
);

export default app;
