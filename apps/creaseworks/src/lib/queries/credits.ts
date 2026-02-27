/**
 * Reflection credits — award, balance, history, spend.
 *
 * Credit values:
 *   quick_log          = 1
 *   photo_added        = 2
 *   marketing_consent  = 3
 *   find_again         = 2
 *   streak_bonus       = 5
 *
 * Redemption thresholds:
 *   sampler_pdf       = 10
 *   single_playdate   = 25
 *   full_pack         = 50
 */

import { sql } from "@/lib/db";

/* ------------------------------------------------------------------ */
/*  credit reasons + amounts                                           */
/* ------------------------------------------------------------------ */

export const CREDIT_VALUES = {
  quick_log: 1,
  photo_added: 2,
  marketing_consent: 3,
  find_again: 2,
  streak_bonus: 5,
} as const;

export type CreditReason = keyof typeof CREDIT_VALUES;

export const REDEMPTION_THRESHOLDS = {
  sampler_pdf: 10,
  single_playdate: 25,
  full_pack: 50,
} as const;

/* ------------------------------------------------------------------ */
/*  award                                                              */
/* ------------------------------------------------------------------ */

/**
 * Award credits to a user. Returns the new credit row id.
 */
export async function awardCredit(
  userId: string,
  orgId: string | null,
  amount: number,
  reason: string,
  runId?: string | null,
): Promise<string> {
  const result = await sql.query(
    `INSERT INTO reflection_credits (user_id, org_id, amount, reason, run_id)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id`,
    [userId, orgId, amount, reason, runId || null],
  );
  return result.rows[0].id;
}

/* ------------------------------------------------------------------ */
/*  balance                                                            */
/* ------------------------------------------------------------------ */

/**
 * Get a user's current credit balance (earned - spent).
 */
export async function getUserCredits(userId: string): Promise<number> {
  const result = await sql.query(
    `SELECT
       COALESCE((SELECT SUM(amount) FROM reflection_credits WHERE user_id = $1), 0)
       -
       COALESCE((SELECT SUM(credits_spent) FROM credit_redemptions WHERE user_id = $1), 0)
       AS balance`,
    [userId],
  );
  return parseInt(result.rows[0]?.balance ?? "0", 10);
}

/* ------------------------------------------------------------------ */
/*  history                                                            */
/* ------------------------------------------------------------------ */

export interface CreditEvent {
  id: string;
  amount: number;
  reason: string;
  created_at: string;
}

/**
 * Fetch recent credit events for a user.
 */
export async function getUserCreditHistory(
  userId: string,
  limit = 20,
): Promise<CreditEvent[]> {
  const result = await sql.query(
    `SELECT id, amount, reason, created_at
     FROM reflection_credits
     WHERE user_id = $1
     ORDER BY created_at DESC
     LIMIT $2`,
    [userId, limit],
  );
  return result.rows;
}

/* ------------------------------------------------------------------ */
/*  spend                                                              */
/* ------------------------------------------------------------------ */

/**
 * Spend credits on a reward. Checks balance first.
 * Returns the redemption id, or throws if insufficient balance.
 */
export async function spendCredits(
  userId: string,
  orgId: string | null,
  amount: number,
  rewardType: string,
  rewardRef?: string | null,
): Promise<string> {
  const balance = await getUserCredits(userId);
  if (balance < amount) {
    throw new Error(
      `Insufficient credits: balance ${balance}, needed ${amount}`,
    );
  }

  const result = await sql.query(
    `INSERT INTO credit_redemptions (user_id, org_id, credits_spent, reward_type, reward_ref)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id`,
    [userId, orgId, amount, rewardType, rewardRef || null],
  );
  return result.rows[0].id;
}
