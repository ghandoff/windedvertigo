/**
 * BIZ-E1 eligibility gate — pure logic layer.
 *
 * Separated from the Supabase layer so it can be unit-tested without a DB.
 * The route handler and checkEligibilityGate() in rfp-requirements.ts both
 * ultimately rely on this logic.
 */

export type EligibilityVerdict = "pass" | "fail" | "n-a" | "covered";

export interface EligibilityRow {
  id: string;
  label: string;
  required: boolean;
  verdict: EligibilityVerdict | null;
  evidence: string | null;
}

export interface EligibilityGateOutcome {
  passed: boolean;
  blockingCheck: string | null;
  blockingReason: "incomplete" | "uncovered_fail" | null;
}

/**
 * Evaluate a set of eligibility rows against the gate rules.
 *
 * Rules (canonical source: .brain/memory/biz/bid-eligibility-screen.md):
 *   - Every required row must have a verdict (null → "incomplete" → blocks)
 *   - 'fail' verdict → "uncovered_fail" → blocks
 *   - 'covered' with no evidence → treated as "uncovered_fail" → blocks
 *   - 'pass' and 'n-a' always allowed
 */
export function evaluateEligibilityGate(rows: EligibilityRow[]): EligibilityGateOutcome {
  for (const row of rows) {
    if (!row.required) continue;

    if (row.verdict === null) {
      return { passed: false, blockingCheck: row.label, blockingReason: "incomplete" };
    }
    if (row.verdict === "fail") {
      return { passed: false, blockingCheck: row.label, blockingReason: "uncovered_fail" };
    }
    if (row.verdict === "covered" && !row.evidence?.trim()) {
      return { passed: false, blockingCheck: row.label, blockingReason: "uncovered_fail" };
    }
  }
  return { passed: true, blockingCheck: null, blockingReason: null };
}
