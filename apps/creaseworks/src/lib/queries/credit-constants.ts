/**
 * Credit constants — shared between server and client code.
 *
 * Extracted from credits.ts so client components can import these
 * without pulling in the server-only database module.
 */

export const CREDIT_VALUES = {
  quick_log: 1,
  full_reflection: 1,
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
