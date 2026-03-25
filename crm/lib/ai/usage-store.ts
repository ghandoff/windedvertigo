/**
 * Token usage store — tracks AI costs.
 *
 * Uses /tmp on Vercel (writable ephemeral storage) for the usage log,
 * with graceful fallback to in-memory when filesystem is unavailable.
 * Data resets on cold starts — for persistent tracking, wire up a
 * Notion database or Vercel KV in the future.
 */

import type { AiFeature, TokenUsageEntry, UsageSummary, Budget, CostBreakdown } from "./types";

// ── in-memory fallback store ─────────────────────────────
// Persists across warm invocations on the same serverless instance.

let memoryLog: TokenUsageEntry[] = [];
let memoryBudget: BudgetConfig | null = null;

// ── filesystem helpers (use /tmp on Vercel) ──────────────

const DATA_DIR = "/tmp/ai-usage";
const LOG_FILE = `${DATA_DIR}/usage.jsonl`;
const BUDGET_FILE = `${DATA_DIR}/budget.json`;

async function fsWrite(path: string, data: string): Promise<boolean> {
  try {
    const { mkdir, writeFile } = await import("fs/promises");
    await mkdir(DATA_DIR, { recursive: true });
    await writeFile(path, data);
    return true;
  } catch {
    return false;
  }
}

async function fsAppend(path: string, data: string): Promise<boolean> {
  try {
    const { mkdir, appendFile } = await import("fs/promises");
    await mkdir(DATA_DIR, { recursive: true });
    await appendFile(path, data);
    return true;
  } catch {
    return false;
  }
}

async function fsRead(path: string): Promise<string | null> {
  try {
    const { readFile } = await import("fs/promises");
    return await readFile(path, "utf-8");
  } catch {
    return null;
  }
}

// ── record usage ─────────────────────────────────────────

/** Append a usage entry to the log. */
export async function recordUsage(entry: TokenUsageEntry): Promise<void> {
  memoryLog.push(entry);
  await fsAppend(LOG_FILE, JSON.stringify(entry) + "\n");
}

// ── read usage ───────────────────────────────────────────

/** Read all usage entries, optionally filtered by date range. */
export async function getUsageEntries(
  from?: string,
  to?: string,
): Promise<TokenUsageEntry[]> {
  // Try filesystem first, fall back to memory
  let entries: TokenUsageEntry[] = [];

  const raw = await fsRead(LOG_FILE);
  if (raw) {
    entries = raw
      .split("\n")
      .filter(Boolean)
      .map((line) => {
        try { return JSON.parse(line); } catch { return null; }
      })
      .filter(Boolean);
  } else {
    entries = [...memoryLog];
  }

  if (from || to) {
    return entries.filter((e) => {
      if (from && e.timestamp < from) return false;
      if (to && e.timestamp > to) return false;
      return true;
    });
  }

  return entries;
}

/** Summarize usage for a period. */
export async function getUsageSummary(
  from: string,
  to: string,
): Promise<UsageSummary> {
  const entries = await getUsageEntries(from, to);

  const features: AiFeature[] = [
    "email-draft",
    "nl-search",
    "relationship-score",
    "next-best-action",
  ];

  const byFeature = {} as UsageSummary["byFeature"];
  for (const f of features) {
    byFeature[f] = { requests: 0, inputTokens: 0, outputTokens: 0, costUsd: 0 };
  }

  let totalRequests = 0;
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let totalCostUsd = 0;

  for (const e of entries) {
    totalRequests++;
    totalInputTokens += e.inputTokens;
    totalOutputTokens += e.outputTokens;
    totalCostUsd += e.costUsd;

    const bucket = byFeature[e.feature];
    if (bucket) {
      bucket.requests++;
      bucket.inputTokens += e.inputTokens;
      bucket.outputTokens += e.outputTokens;
      bucket.costUsd += e.costUsd;
    }
  }

  return {
    totalRequests,
    totalInputTokens,
    totalOutputTokens,
    totalCostUsd,
    byFeature,
    periodStart: from,
    periodEnd: to,
  };
}

// ── budget management ────────────────────────────────────

interface BudgetConfig {
  monthlyLimitUsd: number;
  warningThresholdPct: number;
}

const DEFAULT_BUDGET: BudgetConfig = {
  monthlyLimitUsd: 50,
  warningThresholdPct: 80,
};

export async function getBudgetConfig(): Promise<BudgetConfig> {
  // Try filesystem, then memory, then defaults
  const raw = await fsRead(BUDGET_FILE);
  if (raw) {
    try { return { ...DEFAULT_BUDGET, ...JSON.parse(raw) }; } catch {}
  }
  if (memoryBudget) return memoryBudget;
  return DEFAULT_BUDGET;
}

export async function setBudgetConfig(config: Partial<BudgetConfig>): Promise<BudgetConfig> {
  const current = await getBudgetConfig();
  const updated = { ...current, ...config };
  memoryBudget = updated;
  await fsWrite(BUDGET_FILE, JSON.stringify(updated, null, 2));
  return updated;
}

export async function getBudgetStatus(): Promise<Budget> {
  const config = await getBudgetConfig();

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString();

  const summary = await getUsageSummary(monthStart, monthEnd);
  const currentSpendUsd = summary.totalCostUsd;
  const remainingUsd = Math.max(0, config.monthlyLimitUsd - currentSpendUsd);
  const spendPct = config.monthlyLimitUsd > 0 ? (currentSpendUsd / config.monthlyLimitUsd) * 100 : 0;

  return {
    monthlyLimitUsd: config.monthlyLimitUsd,
    warningThresholdPct: config.warningThresholdPct,
    currentSpendUsd,
    remainingUsd,
    isOverBudget: currentSpendUsd >= config.monthlyLimitUsd,
    isNearLimit: spendPct >= config.warningThresholdPct,
  };
}

// ── full cost breakdown ──────────────────────────────────

export async function getCostBreakdown(): Promise<CostBreakdown> {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString();

  const summary = await getUsageSummary(monthStart, monthEnd);

  // Days elapsed this month
  const dayOfMonth = now.getDate();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const projectionMultiplier = dayOfMonth > 0 ? daysInMonth / dayOfMonth : 1;

  const byFeatureCost: Record<AiFeature, number> = {
    "email-draft": summary.byFeature["email-draft"].costUsd,
    "nl-search": summary.byFeature["nl-search"].costUsd,
    "relationship-score": summary.byFeature["relationship-score"].costUsd,
    "next-best-action": summary.byFeature["next-best-action"].costUsd,
  };

  // Estimate Notion API calls: ~3 per AI request (fetch context)
  const estimatedNotionCalls = summary.totalRequests * 3;

  // Estimate compute: ~2 seconds avg per AI call at 256MB
  const avgFnDurationS = 2;
  const memoryGb = 0.25;
  const estimatedGbSeconds = summary.totalRequests * avgFnDurationS * memoryGb;
  const vercelComputeRate = 0.00005; // $/GB-s on Pro plan

  // Bandwidth: ~2KB per request + response avg
  const estimatedBandwidthGb = (summary.totalRequests * 2) / (1024 * 1024);

  const computeMonthly = estimatedGbSeconds * vercelComputeRate * projectionMultiplier;
  const infraMonthly = 0; // R2 + bandwidth within free tier for this scale

  return {
    apiCosts: {
      monthly: summary.totalCostUsd,
      projected: summary.totalCostUsd * projectionMultiplier,
      byFeature: byFeatureCost,
    },
    notionApiCosts: {
      estimatedCallsPerMonth: Math.round(estimatedNotionCalls * projectionMultiplier),
      withinFreeTier: estimatedNotionCalls * projectionMultiplier < 500_000,
    },
    computeCosts: {
      estimatedFunctionMs: summary.totalRequests * avgFnDurationS * 1000,
      estimatedGbSeconds,
      monthlyEstimate: computeMonthly,
    },
    infrastructureCosts: {
      vercelBandwidthGb: estimatedBandwidthGb * projectionMultiplier,
      r2StorageGb: 0,
      monthlyEstimate: infraMonthly,
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
      summary.totalCostUsd * projectionMultiplier +
      computeMonthly +
      infraMonthly,
  };
}
