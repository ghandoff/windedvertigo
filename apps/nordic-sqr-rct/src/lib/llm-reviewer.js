/**
 * AI Reviewer Account Manager
 * Ensures a system AI reviewer exists in the Reviewer DB.
 * Idempotent — safe to call on every AI review trigger.
 */

import bcrypt from 'bcryptjs';
import { getReviewerByAlias, createReviewer } from '@/lib/notion';

const AI_ALIAS = 'AI-Reviewer';
const SALT_ROUNDS = 12;

/**
 * Get or create the AI reviewer account.
 * @returns {Promise<{ reviewerId: string, alias: string }>}
 */
export async function ensureAIReviewerExists() {
  // Check if AI reviewer already exists
  const existing = await getReviewerByAlias(AI_ALIAS);
  if (existing) {
    // getReviewerByAlias returns the raw Notion page; extract the ID
    return {
      reviewerId: existing.id,
      alias: AI_ALIAS,
    };
  }

  // Create new AI reviewer account
  const page = await createReviewer({
    firstName: 'AI',
    lastName: 'Reviewer',
    alias: AI_ALIAS,
    email: 'ai-reviewer@system.local',
    affiliation: 'Automated System',
    discipline: 'Automated Quality Assessment',
    password: await bcrypt.hash(`ai-system-${Date.now()}-no-login`, SALT_ROUNDS),
    consent: true,
  });

  return {
    reviewerId: page.id,
    alias: AI_ALIAS,
  };
}
