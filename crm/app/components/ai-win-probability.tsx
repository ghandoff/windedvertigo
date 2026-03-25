import type { RfpOpportunity } from "@/lib/notion/types";

/**
 * Compute win probability from existing RFP fields — no AI call needed.
 * Formula-based scoring using fit score, service match, and status progression.
 */
export function computeWinProbability(rfp: RfpOpportunity): number {
  let score = 30; // baseline

  // Fit score impact
  if (rfp.wvFitScore === "high fit") score += 25;
  else if (rfp.wvFitScore === "medium fit") score += 10;
  else if (rfp.wvFitScore === "low fit") score -= 10;

  // Service match breadth
  if (rfp.serviceMatch.length >= 3) score += 15;
  else if (rfp.serviceMatch.length >= 1) score += 5;

  // Status progression bonus
  if (rfp.status === "interviewing") score += 15;
  else if (rfp.status === "submitted") score += 10;
  else if (rfp.status === "pursuing") score += 5;

  // Value penalty (higher value = more competitive)
  if (rfp.estimatedValue && rfp.estimatedValue > 500000) score -= 5;

  return Math.max(5, Math.min(95, score));
}

export function WinProbabilityBadge({ probability }: { probability: number }) {
  const color =
    probability >= 60 ? "text-green-600 bg-green-50 border-green-200" :
    probability >= 35 ? "text-yellow-600 bg-yellow-50 border-yellow-200" :
    "text-red-600 bg-red-50 border-red-200";

  return (
    <span className={`inline-flex items-center text-[10px] font-medium px-1.5 py-0.5 rounded border ${color}`}>
      {probability}% win
    </span>
  );
}
