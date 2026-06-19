/**
 * AICS Claim Reviews — read/write for the `aics_claim_reviews` table.
 *
 * This table is Postgres-only (created in migration 015_aics_claim_reviews.sql).
 * No Notion mirror — reviews are a platform-native concept.
 *
 * reviewer_type: 'internal' for ra/researcher users, 'contractor' for aics-reviewer-only users.
 */

import { getPcsSupabase } from './supabase-pcs.js';

const TABLE = 'aics_claim_reviews';

/**
 * Submit a claim review.
 *
 * @param {object} fields
 * @param {string} fields.aicsClaimId   - notion_page_id of the AICS claim being reviewed
 * @param {string} fields.reviewerId    - notion_page_id of the reviewer (from user token)
 * @param {'internal'|'contractor'} fields.reviewerType
 * @param {'approved'|'rejected'} fields.decision
 * @param {string} [fields.notes]
 * @returns {Promise<object>} created review row
 */
export async function createAicsClaimReview({ aicsClaimId, reviewerId, reviewerType, decision, notes }) {
  if (!aicsClaimId) throw new Error('createAicsClaimReview: aicsClaimId is required');
  if (!reviewerId) throw new Error('createAicsClaimReview: reviewerId is required');
  if (!['approved', 'rejected'].includes(decision)) {
    throw new Error(`createAicsClaimReview: decision must be 'approved' or 'rejected', got '${decision}'`);
  }
  if (!['internal', 'contractor'].includes(reviewerType)) {
    throw new Error(`createAicsClaimReview: reviewerType must be 'internal' or 'contractor', got '${reviewerType}'`);
  }

  const sb = getPcsSupabase();
  const { data, error } = await sb
    .from(TABLE)
    .insert({
      aics_claim_id: aicsClaimId,
      reviewer_id: reviewerId,
      reviewer_type: reviewerType,
      decision,
      notes: notes || null,
    })
    .select()
    .single();

  if (error) throw new Error(`createAicsClaimReview: ${error.message}`);
  return parseReviewRow(data);
}

/**
 * Fetch all reviews for a specific AICS claim.
 *
 * @param {string} aicsClaimId
 * @returns {Promise<object[]>}
 */
export async function getReviewsForClaim(aicsClaimId) {
  if (!aicsClaimId) return [];
  const sb = getPcsSupabase();
  const { data, error } = await sb
    .from(TABLE)
    .select('*')
    .eq('aics_claim_id', aicsClaimId)
    .order('reviewed_at', { ascending: false });

  if (error) {
    console.error('[aics-reviews] getReviewsForClaim error:', error.message);
    return [];
  }
  return (data || []).map(parseReviewRow);
}

/**
 * Fetch all reviews submitted by a specific reviewer.
 * Used by the analytics API to compute per-reviewer stats.
 *
 * @param {string} reviewerId
 * @returns {Promise<object[]>}
 */
export async function getReviewsByReviewer(reviewerId) {
  if (!reviewerId) return [];
  const sb = getPcsSupabase();
  const { data, error } = await sb
    .from(TABLE)
    .select('*')
    .eq('reviewer_id', reviewerId)
    .order('reviewed_at', { ascending: false });

  if (error) {
    console.error('[aics-reviews] getReviewsByReviewer error:', error.message);
    return [];
  }
  return (data || []).map(parseReviewRow);
}

/**
 * Check whether a reviewer has already submitted a review for a given claim.
 * Used to enforce one-review-per-reviewer-per-claim.
 *
 * @param {string} aicsClaimId
 * @param {string} reviewerId
 * @returns {Promise<object|null>} existing review or null
 */
export async function findExistingReview(aicsClaimId, reviewerId) {
  if (!aicsClaimId || !reviewerId) return null;
  const sb = getPcsSupabase();
  const { data, error } = await sb
    .from(TABLE)
    .select('*')
    .eq('aics_claim_id', aicsClaimId)
    .eq('reviewer_id', reviewerId)
    .maybeSingle();

  if (error) return null;
  return data ? parseReviewRow(data) : null;
}

function parseReviewRow(row) {
  return {
    id: row.id,
    aicsClaimId: row.aics_claim_id,
    reviewerId: row.reviewer_id,
    reviewerType: row.reviewer_type,
    decision: row.decision,
    notes: row.notes || null,
    reviewedAt: row.reviewed_at,
  };
}
