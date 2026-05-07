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

/**
 * Convert a pcs_documents Postgres row into the same shape parsePage returns.
 * COPIED INLINE from apps/nordic-sqr-rct/src/lib/pcs-documents.js (parsePostgresRow).
 */
function parseDocumentRow(row: Record<string, any>) {
  return {
    id: row.notion_page_id,
    pcsId: row.pcs_id || '',
    classification: row.classification || null,
    fileStatus: row.file_status || null,
    productStatus: row.product_status || null,
    transferStatus: row.transfer_status || null,
    documentNotes: row.document_notes || '',
    approvedDate: row.approved_date || null,
    latestVersionId: row.latest_version_id || null,
    allVersionIds: row.all_version_ids || [],
    finishedGoodName: row.finished_good_name || '',
    format: row.format || null,
    sapMaterialNo: row.sap_material_no || '',
    skus: row.skus || [],
    archived: row.archived || false,
    templateVersion: row.template_version || null,
    templateSignals: row.template_signals || '',
    linkedAicsIds: row.linked_aics_ids || [],
    canonicalDocumentId: row.canonical_document_id || null,
    createdTime: row.notion_created_at,
    lastEditedTime: row.notion_last_edited_at,
  };
}

/**
 * Convert a pcs_ingredients Postgres row into the same shape parsePage returns.
 * COPIED INLINE from apps/nordic-sqr-rct/src/lib/pcs-ingredients.js (parsePostgresRow).
 */
function parseIngredientRow(row: Record<string, any>) {
  return {
    id: row.notion_page_id,
    canonicalName: row.canonical_name || '',
    synonyms: row.synonyms || '',
    category: row.category || null,
    standardUnit: row.standard_unit || null,
    fdaRdi: row.fda_rdi ?? null,
    fdaRdiUnit: row.fda_rdi_unit || null,
    regulatoryCeiling: row.regulatory_ceiling ?? null,
    bioavailabilityNotes: row.bioavailability_notes || '',
    interactionCautions: row.interaction_cautions || '',
    notes: row.notes || '',
    formIds: row.form_ids || [],
    createdTime: row.notion_created_at,
    lastEditedTime: row.notion_last_edited_at,
  };
}

/**
 * Convert a pcs_canonical_claims Postgres row into the same shape parsePage returns.
 * COPIED INLINE from apps/nordic-sqr-rct/src/lib/pcs-canonical-claims.js (parsePostgresRow).
 */
function parseCanonicalClaimRow(row: Record<string, any>) {
  return {
    id: row.notion_page_id,
    canonicalClaim: row.canonical_claim || '',
    claimFamily: row.claim_family || null,
    evidenceTierRequired: row.evidence_tier_required || null,
    minimumEvidenceItems: row.minimum_evidence_items ?? null,
    notesGuardrails: row.notes_guardrails || '',
    pcsClaimInstanceIds: row.pcs_claim_instance_ids || [],
    claimPrefixId: row.claim_prefix_id || null,
    coreBenefitId: row.core_benefit_id || null,
    activeIngredientId: row.active_ingredient_id || null,
    benefitCategoryId: row.benefit_category_id || null,
    sourceCaipbRowId: row.source_caipb_row_id ?? null,
    canonicalKey: row.canonical_key || null,
    doseSensitivityApplied: row.dose_sensitivity_applied || null,
    dedupeDecision: row.dedupe_decision || null,
    createdTime: row.notion_created_at,
    lastEditedTime: row.notion_last_edited_at,
  };
}

/**
 * Convert a pcs_core_benefits Postgres row into the same shape parsePage returns.
 * COPIED INLINE from apps/nordic-sqr-rct/src/lib/pcs-core-benefits.js (parsePostgresRow).
 */
function parseCoreBenefitRow(row: Record<string, any>) {
  return {
    id: row.notion_page_id,
    coreBenefit: row.core_benefit || '',
    benefitCategoryId: row.benefit_category_id || null,
    notes: row.notes || '',
    pcsClaimInstanceIds: row.pcs_claim_instance_ids || [],
    createdTime: row.notion_created_at,
    lastEditedTime: row.notion_last_edited_at,
  };
}

/**
 * Convert a pcs_evidence_packets Postgres row into the same shape parsePage returns.
 * COPIED INLINE from apps/nordic-sqr-rct/src/lib/pcs-evidence-packets.js (parsePostgresRow).
 */
function parseEvidencePacketRow(row: Record<string, any>) {
  return {
    id: row.notion_page_id,
    name: row.name || '',
    pcsClaimId: row.pcs_claim_id || null,
    evidenceItemId: row.evidence_item_id || null,
    evidenceRole: row.evidence_role || null,
    meetsSqrThreshold: row.meets_sqr_threshold || false,
    relevanceNote: row.relevance_note || '',
    sortOrder: row.sort_order ?? null,
    substantiationTier: row.substantiation_tier || null,
    studyDoseAI: row.study_dose_ai || '',
    studyDoseAmount: row.study_dose_amount ?? null,
    studyDoseUnit: row.study_dose_unit || null,
    nullResultRationale: row.null_result_rationale || '',
    keyTakeaway: row.key_takeaway || '',
    studyDesignSummary: row.study_design_summary || '',
    sampleSize: row.sample_size ?? null,
    positiveResults: row.positive_results || '',
    neutralResults: row.neutral_results || '',
    negativeResults: row.negative_results || '',
    potentialBiases: row.potential_biases || '',
    confidence: row.confidence ?? null,
    createdTime: row.notion_created_at,
    lastEditedTime: row.notion_last_edited_at,
  };
}

// ── /api/pcs/documents ───────────────────────────────────────────────
// Read-only mirror of the pcs_documents table.
app.get('/api/pcs/documents', async (c) => {
  const sb = getSupabase(c.env);
  if (!sb) {
    return c.json({ ok: false, error: 'supabase-not-configured' }, 503);
  }
  const { data, error } = await sb
    .from('pcs_documents')
    .select('*')
    .order('notion_last_edited_at', { ascending: false })
    .limit(2000);
  if (error) {
    return c.json({ ok: false, error: error.message }, 502);
  }
  return c.json({ ok: true, count: data?.length ?? 0, documents: (data || []).map(parseDocumentRow) });
});

// ── /api/pcs/ingredients ─────────────────────────────────────────────
// Read-only mirror of the pcs_ingredients table.
app.get('/api/pcs/ingredients', async (c) => {
  const sb = getSupabase(c.env);
  if (!sb) {
    return c.json({ ok: false, error: 'supabase-not-configured' }, 503);
  }
  const { data, error } = await sb
    .from('pcs_ingredients')
    .select('*')
    .order('notion_last_edited_at', { ascending: false })
    .limit(2000);
  if (error) {
    return c.json({ ok: false, error: error.message }, 502);
  }
  return c.json({ ok: true, count: data?.length ?? 0, ingredients: (data || []).map(parseIngredientRow) });
});

// ── /api/pcs/canonical-claims ────────────────────────────────────────
// Read-only mirror of the pcs_canonical_claims table.
app.get('/api/pcs/canonical-claims', async (c) => {
  const sb = getSupabase(c.env);
  if (!sb) {
    return c.json({ ok: false, error: 'supabase-not-configured' }, 503);
  }
  const { data, error } = await sb
    .from('pcs_canonical_claims')
    .select('*')
    .order('notion_last_edited_at', { ascending: false })
    .limit(2000);
  if (error) {
    return c.json({ ok: false, error: error.message }, 502);
  }
  return c.json({ ok: true, count: data?.length ?? 0, canonicalClaims: (data || []).map(parseCanonicalClaimRow) });
});

// ── /api/pcs/core-benefits ───────────────────────────────────────────
// Read-only mirror of the pcs_core_benefits table.
app.get('/api/pcs/core-benefits', async (c) => {
  const sb = getSupabase(c.env);
  if (!sb) {
    return c.json({ ok: false, error: 'supabase-not-configured' }, 503);
  }
  const { data, error } = await sb
    .from('pcs_core_benefits')
    .select('*')
    .order('notion_last_edited_at', { ascending: false })
    .limit(2000);
  if (error) {
    return c.json({ ok: false, error: error.message }, 502);
  }
  return c.json({ ok: true, count: data?.length ?? 0, coreBenefits: (data || []).map(parseCoreBenefitRow) });
});

// ── /api/pcs/evidence-packets ────────────────────────────────────────
// Read-only mirror of the pcs_evidence_packets table.
app.get('/api/pcs/evidence-packets', async (c) => {
  const sb = getSupabase(c.env);
  if (!sb) {
    return c.json({ ok: false, error: 'supabase-not-configured' }, 503);
  }
  const { data, error } = await sb
    .from('pcs_evidence_packets')
    .select('*')
    .order('notion_last_edited_at', { ascending: false })
    .limit(2000);
  if (error) {
    return c.json({ ok: false, error: error.message }, 502);
  }
  return c.json({ ok: true, count: data?.length ?? 0, evidencePackets: (data || []).map(parseEvidencePacketRow) });
});

// ── 404 fallback ────────────────────────────────────────────────────
app.notFound((c) =>
  c.json(
    {
      ok: false,
      error: 'not-found',
      hint: 'try /health, /health/db, /api/pcs/evidence, /api/pcs/claims, /api/pcs/documents, /api/pcs/ingredients, /api/pcs/canonical-claims, /api/pcs/core-benefits, or /api/pcs/evidence-packets',
    },
    404,
  ),
);

export default app;
