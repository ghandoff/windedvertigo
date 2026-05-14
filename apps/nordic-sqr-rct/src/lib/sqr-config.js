/**
 * SQR-RCT subsystem configuration.
 * Mirrors pcs-config.js for the SQR-RCT subsystem.
 */
import { getPcsSupabase, shouldUseStrongConsistency } from './supabase-pcs.js';

export const SQR_DB = {
  reviewers: process.env.NOTION_REVIEWER_DB,
  intakes:   process.env.NOTION_INTAKE_DB,
  scores:    process.env.NOTION_SCORES_DB,
};

export function shouldReadFromSqrPostgres() {
  const flag = process.env.SQR_READ_FROM_POSTGRES;
  if (flag !== '1' && flag !== 'true') return false;
  return getPcsSupabase() !== null;
}

export function shouldWriteToSqrPostgresFirst() {
  const flag = process.env.SQR_WRITE_TO_POSTGRES;
  if (flag !== '1' && flag !== 'true') return false;
  return getPcsSupabase() !== null;
}

// Reuse PCS_STRONG_CONSISTENCY — same retry queue, same semantics
export { shouldUseStrongConsistency as shouldUseSqrStrongConsistency };
