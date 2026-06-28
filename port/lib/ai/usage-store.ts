/**
 * Token usage store — tracks AI costs in Supabase.
 *
 * Previous implementation used /tmp (Vercel filesystem) which does not exist
 * on Cloudflare Workers. All writes silently failed and in-memory state
 * evaporated on every request, causing permanent zeros in the AI Hub.
 *
 * This version writes directly to `ai_usage_logs` and `ai_budget_config`
 * in Supabase, giving durable cross-request persistence on CF Workers.
 */

import { supabase } from "@/lib/supabase/client";
import type { AiFeature, TokenUsageEntry, UsageSummary, Budget, CostBreakdown } from "./types";

// ── record usage ─────────────────────────────────────────

/** Insert a usage entry. Fire-and-forget safe (caller wraps in .catch). */
export async function recordUsage(entry: TokenUsageEntry): Promise<void> {
  await supabase.from("ai_usage_logs").insert({
    id:            entry.id,
    timestamp:     entry.timestamp,
    feature:       entry.feature,
    model:         entry.model,
    input_tokens:  entry.inputTokens,
    output_tokens: entry.outputTokens,
    cost_usd:      entry.costUsd,
    user_id:       entry.userId,
    duration_ms:   entry.durationMs,
    metadata:      entry.metadata ?? null,
  });
  // Supabase client swallows errors into `.error` field — nothing throws.
}

// ── read usage ───────────────────────────────────────────

export async function getUsageEntries(
  from?: string,
  to?: string,
): Promise<TokenUsageEntry[]> {
  let query = supabase
    .from("ai_usage_logs")
    .select("*")
    .order("timestamp", { ascending: false })
    .limit(5000);

  if (from) query = query.gte("timestamp", from);
  if (to)   query = query.lte("timestamp", to);

  const { data, error } = await query;
  if (error || !data) return [];

  return data.map((row) => ({
    id:           row.id,
    timestamp:    row.timestamp,
    feature:      row.feature as AiFeature,
    model:        row.model,
    inputTokens:  row.input_tokens,
    outputTokens: row.output_tokens,
    costUsd:      Number(row.cost_usd),
    userId:       row.user_id ?? "unknown",
    durationMs:   row.duration_ms ?? 0,
    metadata:     row.metadata ?? undefined,
  }));
}

export async function getUsageSummary(
  from: string,
  to: string,
): Promise<UsageSummary> {
  const entries = await getUsageEntries(from, to);

  const ALL_FEATURES: AiFeature[] = [
    "email-draft", "nl-search", "relationship-score", "next-best-action",
    "org-enrichment", "rfp-triage", "proposal-generation",
    "rfp-document-extraction", "rfp-question-parse", "citation-matching",
    "task-generation", "meeting-actions", "weekly-digest", "conference-triage",
    "carl-study", "carl-research", "bibliography-import",
  ];

  const byFeature = {} as UsageSummary["byFeature"];
  for (const f of ALL_FEATURES) {
    byFeature[f] = { requests: 0, inputTokens: 0, outputTokens: 0, costUsd: 0 };
  }

  let totalRequests = 0;
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let totalCostUsd = 0;

  for (const e of entries) {
    totalRequests++;
    totalInputTokens  += e.inputTokens;
    totalOutputTokens += e.outputTokens;
    totalCostUsd      += e.costUsd;

    const bucket = byFeature[e.feature];
    if (bucket) {
      bucket.requests++;
      bucket.inputTokens  += e.inputTokens;
      bucket.outputTokens += e.outputTokens;
      bucket.costUsd      += e.costUsd;
    }
  }

  return { totalRequests, totalInputTokens, totalOutputTokens, totalCostUsd, byFeature, periodStart: from, periodEnd: to };
}

// ── budget management ────────────────────────────────────

interface BudgetConfig {
  monthlyLimitUsd: number;
  warningThresholdPct: number;
}

const DEFAULT_BUDGET: BudgetConfig = { monthlyLimitUsd: 50, warningThresholdPct: 80 };

export async function getBudgetConfig(): Promise<BudgetConfig> {
  const { data } = await supabase
    .from("ai_budget_config")
    .select("monthly_limit_usd, warning_threshold_pct")
    .eq("id", 1)
    .maybeSingle();

  if (!data) return DEFAULT_BUDGET;
  return {
    monthlyLimitUsd:      Number(data.monthly_limit_usd),
    warningThresholdPct:  data.warning_threshold_pct,
  };
}

export async function setBudgetConfig(config: Partial<BudgetConfig>): Promise<BudgetConfig> {
  const current = await getBudgetConfig();
  const updated = { ...current, ...config };

  await supabase.from("ai_budget_config").upsert({
    id:                    1,
    monthly_limit_usd:     updated.monthlyLimitUsd,
    warning_threshold_pct: updated.warningThresholdPct,
    updated_at:            new Date().toISOString(),
  });

  return updated;
}

export async function getBudgetStatus(): Promise<Budget> {
  const config = await getBudgetConfig();

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const monthEnd   = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString();

  const summary         = await getUsageSummary(monthStart, monthEnd);
  const currentSpendUsd = summary.totalCostUsd;
  const remainingUsd    = Math.max(0, config.monthlyLimitUsd - currentSpendUsd);
  const spendPct        = config.monthlyLimitUsd > 0
    ? (currentSpendUsd / config.monthlyLimitUsd) * 100
    : 0;

  return {
    monthlyLimitUsd:      config.monthlyLimitUsd,
    warningThresholdPct:  config.warningThresholdPct,
    currentSpendUsd,
    remainingUsd,
    isOverBudget: currentSpendUsd >= config.monthlyLimitUsd,
    isNearLimit:  spendPct >= config.warningThresholdPct,
  };
}

// ── full cost breakdown ──────────────────────────────────

export async function getCostBreakdown(): Promise<CostBreakdown> {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const monthEnd   = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString();

  const summary = await getUsageSummary(monthStart, monthEnd);

  const dayOfMonth          = now.getDate();
  const daysInMonth         = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const projectionMultiplier = dayOfMonth > 0 ? daysInMonth / dayOfMonth : 1;

  const byFeatureCost: Record<AiFeature, number> = {
    "email-draft":            summary.byFeature["email-draft"]?.costUsd            ?? 0,
    "nl-search":              summary.byFeature["nl-search"]?.costUsd              ?? 0,
    "relationship-score":     summary.byFeature["relationship-score"]?.costUsd     ?? 0,
    "next-best-action":       summary.byFeature["next-best-action"]?.costUsd       ?? 0,
    "org-enrichment":         summary.byFeature["org-enrichment"]?.costUsd         ?? 0,
    "rfp-triage":             summary.byFeature["rfp-triage"]?.costUsd             ?? 0,
    "proposal-generation":    summary.byFeature["proposal-generation"]?.costUsd    ?? 0,
    "rfp-document-extraction":summary.byFeature["rfp-document-extraction"]?.costUsd ?? 0,
    "rfp-question-parse":     summary.byFeature["rfp-question-parse"]?.costUsd     ?? 0,
    "citation-matching":      summary.byFeature["citation-matching"]?.costUsd      ?? 0,
    "task-generation":        summary.byFeature["task-generation"]?.costUsd        ?? 0,
    "meeting-actions":        summary.byFeature["meeting-actions"]?.costUsd        ?? 0,
    "weekly-digest":          summary.byFeature["weekly-digest"]?.costUsd          ?? 0,
    "conference-triage":      summary.byFeature["conference-triage"]?.costUsd      ?? 0,
    "carl-study":             summary.byFeature["carl-study"]?.costUsd             ?? 0,
    "carl-research":          summary.byFeature["carl-research"]?.costUsd          ?? 0,
    "bibliography-import":    summary.byFeature["bibliography-import"]?.costUsd     ?? 0,
    "opsy-email-triage":      summary.byFeature["opsy-email-triage"]?.costUsd       ?? 0,
    "opsy-digest":            summary.byFeature["opsy-digest"]?.costUsd             ?? 0,
    "pam-action-triage":      summary.byFeature["pam-action-triage"]?.costUsd       ?? 0,
    "knowledge-extract":      summary.byFeature["knowledge-extract"]?.costUsd       ?? 0,
  };

  // Estimate Notion API calls: ~3 per AI request (fetch context)
  const estimatedNotionCalls = summary.totalRequests * 3;

  // CF Workers compute: ~2s avg per AI call; billing is CPU time not wall time.
  // CF Workers free = 10ms CPU/req; paid = $0.30/million CPU-ms above 30B.
  // For our scale, we're comfortably within included limits — show $0.
  const cfComputeMonthly = 0;
  const estimatedBandwidthGb = (summary.totalRequests * 2) / (1024 * 1024);

  return {
    apiCosts: {
      monthly:   summary.totalCostUsd,
      projected: summary.totalCostUsd * projectionMultiplier,
      byFeature: byFeatureCost,
    },
    notionApiCosts: {
      estimatedCallsPerMonth: Math.round(estimatedNotionCalls * projectionMultiplier),
      withinFreeTier: (estimatedNotionCalls * projectionMultiplier) < 500_000,
    },
    computeCosts: {
      estimatedFunctionMs: summary.totalRequests * 2_000,
      estimatedGbSeconds:  0, // not applicable on CF Workers (CPU-time billing)
      monthlyEstimate:     cfComputeMonthly,
    },
    infrastructureCosts: {
      vercelBandwidthGb: estimatedBandwidthGb * projectionMultiplier,
      r2StorageGb:       0,
      monthlyEstimate:   0, // within CF free tier at this scale
    },
    operationalCosts: {
      estimatedDevHoursPerMonth: 4,
      maintenanceNotes: [
        "Prompt tuning and quality monitoring (~2 hrs/month)",
        "Model version upgrades when Anthropic releases new models",
        "Usage monitoring and budget adjustments",
        "Bug fixes and edge case handling (~2 hrs/month)",
      ],
    },
    totalMonthlyEstimate:
      summary.totalCostUsd * projectionMultiplier + cfComputeMonthly,
  };
}
