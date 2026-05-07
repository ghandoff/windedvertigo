#!/usr/bin/env node
// scripts/backfill-pcs-to-supabase.mjs
// ─────────────────────────────────────────────────────────────────────
// One-time backfill of all PCS Notion data into Supabase Postgres.
//
// Pulls from the existing src/lib/pcs-*.js helpers (read-only — never
// touches notion.databases.query directly), then upserts each row into
// the corresponding public.pcs_* table defined in db/migrations/001-004.
//
// Idempotent: re-running refreshes existing rows by `notion_page_id`.
//
// Run (after Supabase is provisioned tomorrow):
//   cd apps/nordic-sqr-rct
//   node --env-file=.env.local scripts/backfill-pcs-to-supabase.mjs
//
// Flags:
//   --dry-run               Read only; report row counts; no writes.
//   --table=<table_name>    Only one table (snake_case PG name).
//   --phase=<1|2|3>         Only one dependency phase.
//   --verbose               Log every row being upserted.
//
// Phase ordering (matches the FKs that exist + the FKs Phase B will add):
//   Phase 1 — leaves: pcs_canonical_claims, pcs_wording_variants,
//                     pcs_references, pcs_formula_lines
//   Phase 2 — parents: pcs_documents, pcs_versions, pcs_evidence, pcs_claims
//   Phase 3 — children of Phase 2: pcs_evidence_packets,
//                                   pcs_revision_events, pcs_requests
//   Phase 4 — junction tables (out of scope; populated by separate
//             Phase B script after FK columns are populated).
//
// ─────────────────────────────────────────────────────────────────────

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

// 2026-05-06 — chicken-and-egg guard. Path-2 lib helpers read from
// Postgres when PCS_READ_FROM_POSTGRES=1, but THIS script's job is to
// populate Postgres FROM Notion. If the flag is on, the helpers would
// read from empty Postgres tables and return 0 rows, so the backfill
// would no-op. Force Notion reads regardless of operator env:
process.env.PCS_READ_FROM_POSTGRES = '';

import { getAllDocuments }        from '../src/lib/pcs-documents.js';
import { getAllVersions }         from '../src/lib/pcs-versions.js';
import { getAllClaims }           from '../src/lib/pcs-claims.js';
import { getAllEvidence }         from '../src/lib/pcs-evidence.js';
import { getAllEvidencePackets }  from '../src/lib/pcs-evidence-packets.js';
import { getAllCanonicalClaims }  from '../src/lib/pcs-canonical-claims.js';
import { getAllFormulaLines }     from '../src/lib/pcs-formula-lines.js';
import { getAllReferences }       from '../src/lib/pcs-references.js';
import { getAllWordingVariants }  from '../src/lib/pcs-wording-variants.js';
import { getAllRevisionEvents }   from '../src/lib/pcs-revision-events.js';
import { getAllRequests }         from '../src/lib/pcs-requests.js';
import { getAllIngredients }      from '../src/lib/pcs-ingredients.js';
import { getAllCoreBenefits }     from '../src/lib/pcs-core-benefits.js';

// ─── CLI parsing ────────────────────────────────────────────────────
const args = process.argv.slice(2);
const flag = (name) => args.some((a) => a === name);
const opt  = (name) => {
  const m = args.find((a) => a.startsWith(`${name}=`));
  return m ? m.slice(name.length + 1) : null;
};
const DRY_RUN     = flag('--dry-run');
const VERBOSE     = flag('--verbose');
const ONLY_TABLE  = opt('--table');
const ONLY_PHASE  = opt('--phase'); // '1' | '2' | '3'

const BATCH_SIZE  = 100;

// ─── Helpers ────────────────────────────────────────────────────────
function emptyToNull(v) {
  if (v === undefined || v === null) return null;
  if (typeof v === 'string' && v === '') return null;
  return v;
}
function arr(v) {
  return Array.isArray(v) ? v : [];
}
function num(v) {
  return v === undefined || v === null || Number.isNaN(v) ? null : v;
}
function date(v) {
  return v ? v : null; // YYYY-MM-DD string or null
}
function ts(v) {
  return v ? v : null; // ISO timestamp string or null
}
function bool(v) {
  return v === true;
}

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function fmtMs(ms) {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

// ─── Supabase client ────────────────────────────────────────────────
function getSupabase() {
  const url = process.env.SUPABASE_NORDIC_URL;
  // 2026-05-06 — Supabase migrated to new sb_secret_*/sb_publishable_*
  // key format on this project (legacy JWT keys disabled 2026-04-28).
  // Prefer the new SECRET key; fall back to legacy SERVICE/ANON if a
  // user re-enables them temporarily.
  const key =
    process.env.SUPABASE_NORDIC_SECRET_KEY ||
    process.env.SUPABASE_NORDIC_SERVICE_KEY ||
    process.env.SUPABASE_NORDIC_ANON_KEY;
  if (!url || !key) {
    console.error(
      [
        '✗ Missing Supabase env vars.',
        '  Required: SUPABASE_NORDIC_URL and one of:',
        '    SUPABASE_NORDIC_SECRET_KEY  (preferred — new sb_secret_* format)',
        '    SUPABASE_NORDIC_SERVICE_KEY (legacy JWT — only if re-enabled)',
        '    SUPABASE_NORDIC_ANON_KEY    (fallback — may fail on RLS)',
        '  Add these to apps/nordic-sqr-rct/.env.local before running.',
      ].join('\n'),
    );
    process.exit(1);
  }
  if (!process.env.SUPABASE_NORDIC_SECRET_KEY && !process.env.SUPABASE_NORDIC_SERVICE_KEY) {
    console.warn(
      '⚠ Using SUPABASE_NORDIC_ANON_KEY — RLS may block writes. Secret/service key recommended.',
    );
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

// ─── Per-table mappers (camelCase → snake_case) ─────────────────────
// Each returns the row object shaped for the corresponding PG table.
// notion_page_id is always included so .upsert({ onConflict: 'notion_page_id' })
// works idempotently.

function mapDocument(r) {
  return {
    notion_page_id:         r.id,
    pcs_id:                 r.pcsId || '',
    classification:         emptyToNull(r.classification),
    file_status:            emptyToNull(r.fileStatus),
    product_status:         emptyToNull(r.productStatus),
    transfer_status:        emptyToNull(r.transferStatus),
    document_notes:         r.documentNotes || '',
    approved_date:          date(r.approvedDate),
    latest_version_id:      emptyToNull(r.latestVersionId),
    all_version_ids:        arr(r.allVersionIds),
    finished_good_name:     r.finishedGoodName || '',
    format:                 emptyToNull(r.format),
    sap_material_no:        r.sapMaterialNo || '',
    skus:                   arr(r.skus),
    archived:               bool(r.archived),
    template_version:       emptyToNull(r.templateVersion),
    template_signals:       r.templateSignals || '',
    notion_created_at:      ts(r.createdTime),
    notion_last_edited_at:  ts(r.lastEditedTime),
    // NOTE: linkedAicsIds and canonicalDocumentId have no direct columns in
    // pcs_documents (001/002). linkedAicsIds is conceptually a junction
    // (pcs_aics_references) populated in Phase 4. canonicalDocumentId (soft-merge
    // dedup target, added 2026-05-04) has no PG column yet — needs migration 005.
  };
}

function mapVersion(r) {
  return {
    notion_page_id:               r.id,
    version:                      r.version || '',
    pcs_document_id:              emptyToNull(r.pcsDocumentId),
    effective_date:               date(r.effectiveDate),
    is_latest:                    bool(r.isLatest),
    version_notes:                r.versionNotes || '',
    supersedes_id:                emptyToNull(r.supersedesId),
    claim_ids:                    arr(r.claimIds),
    formula_line_ids:             arr(r.formulaLineIds),
    reference_ids:                arr(r.referenceIds),
    revision_event_ids:           arr(r.revisionEventIds),
    request_ids:                  arr(r.requestIds),
    latest_version_of_id:         emptyToNull(r.latestVersionOfId),
    product_name:                 r.productName || '',
    format_override:              r.formatOverride || '',
    demographic:                  arr(r.demographic),
    biological_sex:               arr(r.biologicalSex),
    age_group:                    arr(r.ageGroup),
    life_stage:                   arr(r.lifeStage),
    lifestyle:                    arr(r.lifestyle),
    demographic_backfill_review:  r.demographicBackfillReview || '',
    daily_serving_size:           r.dailyServingSize || '',
    total_epa:                    num(r.totalEPA),
    total_dha:                    num(r.totalDHA),
    total_epa_and_dha:            num(r.totalEPAandDHA),
    total_omega6:                 num(r.totalOmega6),
    total_omega9:                 num(r.totalOmega9),
    notion_created_at:            ts(r.createdTime),
    notion_last_edited_at:        ts(r.lastEditedTime),
  };
}

function mapClaim(r) {
  return {
    notion_page_id:          r.id,
    claim:                   r.claim || '',
    claim_no:                r.claimNo || '',
    claim_bucket:            emptyToNull(r.claimBucket),
    claim_status:            emptyToNull(r.claimStatus),
    claim_notes:             r.claimNotes || '',
    disclaimer_required:     bool(r.disclaimerRequired),
    min_dose_mg:             num(r.minDoseMg),
    max_dose_mg:             num(r.maxDoseMg),
    dose_guidance_note:      r.doseGuidanceNote || '',
    pcs_version_id:          emptyToNull(r.pcsVersionId),
    canonical_claim_id:      emptyToNull(r.canonicalClaimId),
    claim_prefix_id:         emptyToNull(r.claimPrefixId),
    core_benefit_id:         emptyToNull(r.coreBenefitId),
    evidence_packet_ids:     arr(r.evidencePacketIds),
    wording_variant_ids:     arr(r.wordingVariantIds),
    heterogeneity:           emptyToNull(r.heterogeneity),
    publication_bias:        emptyToNull(r.publicationBias),
    funding_bias:            emptyToNull(r.fundingBias),
    precision:               emptyToNull(r.precision),
    effect_size_category:    emptyToNull(r.effectSizeCategory),
    dose_response_gradient:  emptyToNull(r.doseResponseGradient),
    certainty_score:         num(r.certaintyScore),
    certainty_rating:        emptyToNull(r.certaintyRating),
    confidence:              num(r.confidence),
    notion_created_at:       ts(r.createdTime),
    notion_last_edited_at:   ts(r.lastEditedTime),
  };
}

function mapEvidence(r) {
  return {
    notion_page_id:                    r.id,
    name:                              r.name || '',
    citation:                          r.citation || '',
    doi:                               r.doi || '',
    pmid:                              r.pmid || '',
    url:                               emptyToNull(r.url),
    evidence_type:                     emptyToNull(r.evidenceType),
    ingredient:                        arr(r.ingredient),
    publication_year:                  num(r.publicationYear),
    canonical_summary:                 r.canonicalSummary || '',
    endnote_group:                     r.endnoteGroup || '',
    endnote_record_id:                 r.endnoteRecordId || '',
    sqr_score:                         num(r.sqrScore),
    sqr_risk_of_bias:                  emptyToNull(r.sqrRiskOfBias),
    sqr_reviewed:                      bool(r.sqrReviewed),
    sqr_review_date:                   date(r.sqrReviewDate),
    sqr_review_url:                    emptyToNull(r.sqrReviewUrl),
    // Helper exposes file URL as `pdf`; schema column is `pdf_url`.
    pdf_url:                           emptyToNull(r.pdf),
    used_in_packet_ids:                arr(r.usedInPacketIds),
    pcs_reference_ids:                 arr(r.pcsReferenceIds),
    active_ingredient_canonical_ids:   arr(r.activeIngredientCanonicalIds),
    safety_signal:                     bool(r.safetySignal),
    safety_ingredient_ids:             arr(r.safetyIngredientIds),
    safety_dose_threshold:             num(r.safetyDoseThreshold),
    safety_dose_unit:                  r.safetyDoseUnit || '',
    safety_demographic_filter_raw:     r.safetyDemographicFilterRaw || '',
    notion_created_at:                 ts(r.createdTime),
    notion_last_edited_at:             ts(r.lastEditedTime),
  };
}

function mapEvidencePacket(r) {
  return {
    notion_page_id:           r.id,
    name:                     r.name || '',
    pcs_claim_id:             emptyToNull(r.pcsClaimId),
    evidence_item_id:         emptyToNull(r.evidenceItemId),
    evidence_role:            emptyToNull(r.evidenceRole),
    meets_sqr_threshold:      bool(r.meetsSqrThreshold),
    relevance_note:           r.relevanceNote || '',
    sort_order:               num(r.sortOrder),
    substantiation_tier:      emptyToNull(r.substantiationTier),
    study_dose_ai:            r.studyDoseAI || '',
    study_dose_amount:        num(r.studyDoseAmount),
    study_dose_unit:          emptyToNull(r.studyDoseUnit),
    null_result_rationale:    r.nullResultRationale || '',
    key_takeaway:             r.keyTakeaway || '',
    study_design_summary:     r.studyDesignSummary || '',
    sample_size:              num(r.sampleSize),
    positive_results:         r.positiveResults || '',
    neutral_results:          r.neutralResults || '',
    negative_results:         r.negativeResults || '',
    potential_biases:         r.potentialBiases || '',
    confidence:               num(r.confidence),
    notion_created_at:        ts(r.createdTime),
    notion_last_edited_at:    ts(r.lastEditedTime),
  };
}

// 2026-05-06 — added with migration 006 (Path-2 Day 2.6).
function mapIngredient(r) {
  return {
    notion_page_id:           r.id,
    canonical_name:           r.canonicalName || '',
    synonyms:                 r.synonyms || '',
    category:                 emptyToNull(r.category),
    standard_unit:            emptyToNull(r.standardUnit),
    fda_rdi:                  num(r.fdaRdi),
    fda_rdi_unit:             emptyToNull(r.fdaRdiUnit),
    regulatory_ceiling:       num(r.regulatoryCeiling),
    bioavailability_notes:    r.bioavailabilityNotes || '',
    interaction_cautions:     r.interactionCautions || '',
    notes:                    r.notes || '',
    form_ids:                 arr(r.formIds),
    notion_created_at:        ts(r.createdTime),
    notion_last_edited_at:    ts(r.lastEditedTime),
  };
}

function mapCoreBenefit(r) {
  return {
    notion_page_id:           r.id,
    core_benefit:             r.coreBenefit || '',
    benefit_category_id:      emptyToNull(r.benefitCategoryId),
    notes:                    r.notes || '',
    pcs_claim_instance_ids:   arr(r.pcsClaimInstanceIds),
    notion_created_at:        ts(r.createdTime),
    notion_last_edited_at:    ts(r.lastEditedTime),
  };
}

function mapCanonicalClaim(r) {
  return {
    notion_page_id:               r.id,
    canonical_claim:              r.canonicalClaim || '',
    claim_family:                 emptyToNull(r.claimFamily),
    evidence_tier_required:       emptyToNull(r.evidenceTierRequired),
    minimum_evidence_items:       num(r.minimumEvidenceItems),
    notes_guardrails:             r.notesGuardrails || '',
    pcs_claim_instance_ids:       arr(r.pcsClaimInstanceIds),
    claim_prefix_id:              emptyToNull(r.claimPrefixId),
    core_benefit_id:              emptyToNull(r.coreBenefitId),
    active_ingredient_id:         emptyToNull(r.activeIngredientId),
    benefit_category_id:          emptyToNull(r.benefitCategoryId),
    source_caipb_row_id:          num(r.sourceCaipbRowId),
    canonical_key:                emptyToNull(r.canonicalKey),
    dose_sensitivity_applied:     emptyToNull(r.doseSensitivityApplied),
    dedupe_decision:              emptyToNull(r.dedupeDecision),
    notion_created_at:            ts(r.createdTime),
    notion_last_edited_at:        ts(r.lastEditedTime),
  };
}

function mapFormulaLine(r) {
  return {
    notion_page_id:                          r.id,
    ingredient_form:                         r.ingredientForm || '',
    pcs_version_id:                          emptyToNull(r.pcsVersionId),
    ingredient_source:                       r.ingredientSource || '',
    elemental_ai:                            emptyToNull(r.elementalAI),
    elemental_amount_mg:                     num(r.elementalAmountMg),
    ratio_note:                              r.ratioNote || '',
    serving_basis_note:                      r.servingBasisNote || '',
    formula_notes:                           r.formulaNotes || '',
    ai:                                      r.ai || '',
    ai_form:                                 r.aiForm || '',
    fm_plm:                                  r.fmPlm || '',
    amount_per_serving:                      num(r.amountPerServing),
    amount_unit:                             emptyToNull(r.amountUnit),
    percent_daily_value:                     num(r.percentDailyValue),
    active_ingredient_canonical_id:          emptyToNull(r.activeIngredientCanonicalId),
    active_ingredient_form_canonical_id:     emptyToNull(r.activeIngredientFormCanonicalId),
    confidence:                              num(r.confidence),
    notion_created_at:                       ts(r.createdTime),
    notion_last_edited_at:                   ts(r.lastEditedTime),
  };
}

function mapReference(r) {
  return {
    notion_page_id:              r.id,
    name:                        r.name || '',
    pcs_reference_label:         r.pcsReferenceLabel || '',
    reference_text_as_written:   r.referenceTextAsWritten || '',
    reference_notes:             r.referenceNotes || '',
    pcs_version_id:              emptyToNull(r.pcsVersionId),
    evidence_item_id:            emptyToNull(r.evidenceItemId),
    notion_created_at:           ts(r.createdTime),
    notion_last_edited_at:       ts(r.lastEditedTime),
  };
}

function mapWordingVariant(r) {
  return {
    notion_page_id:          r.id,
    wording:                 r.wording || '',
    pcs_claim_id:            emptyToNull(r.pcsClaimId),
    is_primary:              bool(r.isPrimary),
    variant_notes:           r.variantNotes || '',
    notion_created_at:       ts(r.createdTime),
    notion_last_edited_at:   ts(r.lastEditedTime),
  };
}

// pcs_revision_events schema (001) is polymorphic: entity_type, entity_id,
// field_path, before_value, after_value, actor, reason. The Notion DB
// modelled in src/lib/pcs-revision-events.js uses a different shape
// (event title, activity_type, dept, dates, fromVersion/toVersion). The
// schema pre-dates the current Notion model. For backfill fidelity we
// route the helper's fields into the closest schema columns and stash the
// rest in after_value JSONB so nothing is lost. A follow-up migration
// should reconcile these (see Phase B notes).
function mapRevisionEvent(r) {
  return {
    notion_page_id:        r.id,
    entity_type:           'pcs_versions',
    entity_id:             emptyToNull(r.pcsVersionId) || '',
    field_path:            emptyToNull(r.activityType) || 'event',
    before_value:          r.fromVersion ? { version: r.fromVersion } : null,
    after_value: {
      event:                  r.event || '',
      activity_type:          r.activityType || null,
      responsible_dept:       r.responsibleDept || null,
      responsible_individual: r.responsibleIndividual || null,
      start_date:             r.startDate || null,
      end_date:               r.endDate || null,
      from_version:           r.fromVersion || '',
      to_version:             r.toVersion || '',
      from_version_linked_id: r.fromVersionLinkedId || null,
      to_version_linked_id:   r.toVersionLinkedId || null,
      event_notes:            r.eventNotes || '',
      approver_alias:         r.approverAlias || '',
      approver_department:    r.approverDepartment || null,
    },
    actor:                 r.responsibleIndividual || r.approverAlias || '',
    reason:                r.eventNotes || '',
    notion_created_at:     ts(r.createdTime),
    notion_last_edited_at: ts(r.lastEditedTime),
  };
}

// pcs_requests schema (001) is the "sketch" shape — only a small subset
// of the helper's fields have columns. Map what we can; rest is stubbed.
// TODO(migration 005+): widen pcs_requests to carry the helper's full shape
// (assignees, requestType, raDue, resDue, priority, etc.).
function mapRequest(r) {
  return {
    notion_page_id:        r.id,
    title:                 r.request || '',
    status:                emptyToNull(r.status),
    pcs_document_id:       emptyToNull(r.relatedPcsId),
    pcs_version_id:        emptyToNull(r.pcsVersionId),
    requester:             r.requestedBy || '',
    // schema has a single `due_date`; helper has raDue + resDue. Prefer raDue.
    due_date:              date(r.raDue) || date(r.resDue),
    notes:                 r.requestNotes || '',
    notion_created_at:     ts(r.createdTime),
    notion_last_edited_at: ts(r.lastEditedTime),
  };
}

// ─── Table descriptors ──────────────────────────────────────────────
// Each entry: how to fetch from Notion + how to map + which PG table.
const TABLES = [
  // ── Phase 1 — leaves (no FKs to other Phase 1+2 tables)
  { phase: 1, table: 'pcs_canonical_claims', fetcher: () => getAllCanonicalClaims({ skipCache: true }), mapper: mapCanonicalClaim },
  { phase: 1, table: 'pcs_wording_variants', fetcher: () => getAllWordingVariants(),                    mapper: mapWordingVariant  },
  { phase: 1, table: 'pcs_references',       fetcher: () => getAllReferences(),                          mapper: mapReference       },
  { phase: 1, table: 'pcs_formula_lines',    fetcher: () => getAllFormulaLines(),                        mapper: mapFormulaLine     },
  // 2026-05-06 — added with migration 006 (Path-2 Day 2.6 dropdown helpers)
  { phase: 1, table: 'pcs_ingredients',      fetcher: () => getAllIngredients(50, { skipCache: true }), mapper: mapIngredient      },
  { phase: 1, table: 'pcs_core_benefits',    fetcher: () => getAllCoreBenefits({ skipCache: true }),    mapper: mapCoreBenefit     },

  // ── Phase 2 — parent entities
  { phase: 2, table: 'pcs_documents', fetcher: () => getAllDocuments(50, { skipCache: true }), mapper: mapDocument },
  { phase: 2, table: 'pcs_versions',  fetcher: () => getAllVersions(),                          mapper: mapVersion  },
  { phase: 2, table: 'pcs_evidence',  fetcher: () => getAllEvidence(50, { skipCache: true }),  mapper: mapEvidence },
  { phase: 2, table: 'pcs_claims',    fetcher: () => getAllClaims(50, { skipCache: true }),    mapper: mapClaim    },

  // ── Phase 3 — child entities referencing Phase 2
  { phase: 3, table: 'pcs_evidence_packets', fetcher: () => getAllEvidencePackets(50), mapper: mapEvidencePacket },
  { phase: 3, table: 'pcs_revision_events',  fetcher: () => getAllRevisionEvents(),    mapper: mapRevisionEvent  },
  { phase: 3, table: 'pcs_requests',         fetcher: () => getAllRequests(50),        mapper: mapRequest        },

  // ── Phase 4 — junction tables (TODO; out of scope for this script)
  // The following M:N edges from migration 002 are populated by a separate
  // Phase B script after this script lands and FK UUIDs can be resolved:
  //   - score_reviewers (scores ↔ reviewers)
  //   - version_claims (pcs_versions ↔ pcs_claims)
  //   - packet_evidence (pcs_evidence_packets ↔ pcs_evidence)
  //   - evidence_references (pcs_evidence ↔ pcs_references)
  //   - pcs_aics_references (pcs_documents ↔ aics_documents)
  // The notion_page_id text[] columns on pcs_documents/pcs_versions/pcs_claims/
  // pcs_evidence carry the same edges in denormalized form (already populated
  // by this script), so the junction tables are derivable from those.
];

// ─── Per-table runner ───────────────────────────────────────────────
async function backfillTable(supabase, descriptor, summary) {
  const { table, fetcher, mapper } = descriptor;
  const t0 = Date.now();
  console.log(`[${table}] fetching from Notion...`);

  let raw;
  try {
    raw = await fetcher();
  } catch (err) {
    console.error(`[${table}]   ✗ Notion fetch failed: ${err.message}`);
    summary.push({ table, notionRows: 0, inserted: 0, updated: 0, errors: 1, durationMs: Date.now() - t0, fetchFailed: true });
    return;
  }
  const fetchMs = Date.now() - t0;
  console.log(`[${table}]   got ${raw.length} rows in ${fmtMs(fetchMs)}`);

  if (raw.length === 0) {
    summary.push({ table, notionRows: 0, inserted: 0, updated: 0, errors: 0, durationMs: Date.now() - t0 });
    return;
  }

  const rows = raw.map(mapper);

  if (DRY_RUN) {
    console.log(`[${table}]   [dry-run] would upsert ${rows.length} rows`);
    if (VERBOSE) {
      console.log(`[${table}]   sample row:`, JSON.stringify(rows[0], null, 2));
    }
    summary.push({ table, notionRows: raw.length, inserted: 0, updated: 0, errors: 0, durationMs: Date.now() - t0, dryRun: true });
    return;
  }

  const batches = chunk(rows, BATCH_SIZE);
  let writtenTotal = 0;
  let errorCount = 0;
  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    const tBatch = Date.now();
    console.log(`[${table}] upserting batch ${i + 1}/${batches.length} (${batch.length} rows)...`);

    if (VERBOSE) {
      for (const row of batch) {
        console.log(`[${table}]   upsert ${row.notion_page_id}`);
      }
    }

    const { error, count } = await supabase
      .from(table)
      .upsert(batch, { onConflict: 'notion_page_id', count: 'exact' });

    if (error) {
      errorCount++;
      console.error(`[${table}]   ✗ batch ${i + 1} failed: ${error.message}`);
      if (error.details) console.error(`[${table}]     details: ${error.details}`);
      if (error.hint)    console.error(`[${table}]     hint:    ${error.hint}`);
      // Keep going with subsequent batches — per-row failures shouldn't
      // halt the whole backfill.
      continue;
    }
    writtenTotal += count ?? batch.length;
    console.log(`[${table}]   ✓ done in ${fmtMs(Date.now() - tBatch)}`);
  }

  summary.push({
    table,
    notionRows: raw.length,
    // Supabase's upsert doesn't differentiate insert vs update; report
    // both as "written" and split as written/0 for now.
    inserted:   writtenTotal,
    updated:    0,
    errors:     errorCount,
    durationMs: Date.now() - t0,
  });
}

// ─── Summary printer ────────────────────────────────────────────────
function printSummary(summary) {
  const headers = ['table', 'notion_rows', 'pg_written', 'errors', 'duration'];
  const widths  = [28, 12, 11, 7, 10];

  const pad = (s, w) => String(s).padEnd(w);
  console.log('');
  console.log(headers.map((h, i) => pad(h, widths[i])).join(' '));
  console.log(widths.map((w) => '─'.repeat(w)).join(' '));

  let totals = { rows: 0, written: 0, errors: 0, ms: 0 };
  for (const r of summary) {
    const noteSuffix = r.fetchFailed ? ' (fetch failed)' : r.dryRun ? ' (dry-run)' : '';
    console.log(
      [
        pad(r.table, widths[0]),
        pad(r.notionRows, widths[1]),
        pad(r.inserted, widths[2]),
        pad(r.errors, widths[3]),
        pad(fmtMs(r.durationMs) + noteSuffix, widths[4]),
      ].join(' '),
    );
    totals.rows    += r.notionRows;
    totals.written += r.inserted;
    totals.errors  += r.errors;
    totals.ms      += r.durationMs;
  }
  console.log(widths.map((w) => '─'.repeat(w)).join(' '));
  console.log(
    [
      pad('TOTAL', widths[0]),
      pad(totals.rows, widths[1]),
      pad(totals.written, widths[2]),
      pad(totals.errors, widths[3]),
      pad(fmtMs(totals.ms), widths[4]),
    ].join(' '),
  );
  console.log('');
}

// ─── Main ───────────────────────────────────────────────────────────
async function main() {
  console.log('─── PCS → Supabase backfill ───');
  if (DRY_RUN)    console.log('Mode: DRY-RUN (no writes)');
  if (ONLY_TABLE) console.log(`Filter: --table=${ONLY_TABLE}`);
  if (ONLY_PHASE) console.log(`Filter: --phase=${ONLY_PHASE}`);
  if (VERBOSE)    console.log('Mode: verbose');
  console.log('');

  const supabase = DRY_RUN ? null : getSupabase();

  let toRun = TABLES;
  if (ONLY_PHASE) toRun = toRun.filter((t) => String(t.phase) === ONLY_PHASE);
  if (ONLY_TABLE) toRun = toRun.filter((t) => t.table === ONLY_TABLE);
  if (toRun.length === 0) {
    console.error('✗ No tables matched filters.');
    process.exit(1);
  }

  const summary = [];
  for (const descriptor of toRun) {
    await backfillTable(supabase, descriptor, summary);
  }

  printSummary(summary);

  const totalErrors = summary.reduce((acc, r) => acc + r.errors, 0);
  process.exit(totalErrors > 0 ? 2 : 0);
}

main().catch((err) => {
  console.error('✗ Fatal:', err);
  process.exit(1);
});
