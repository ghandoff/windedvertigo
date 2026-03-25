/**
 * AI feature types and cost model definitions.
 *
 * Covers token economics, usage tracking, and all AI feature interfaces.
 */

// ── cost model ───────────────────────────────────────────

/** Claude model pricing per million tokens (USD). */
export const MODEL_PRICING = {
  "claude-sonnet-4-6": { input: 3.0, output: 15.0 },
  "claude-haiku-4-5-20251001": { input: 0.8, output: 4.0 },
} as const;

export type ModelId = keyof typeof MODEL_PRICING;

/** Default model used for AI features. */
export const DEFAULT_MODEL: ModelId = "claude-sonnet-4-6";

/** Which model each feature uses (lighter model for cheaper operations). */
export const FEATURE_MODELS: Record<AiFeature, ModelId> = {
  "email-draft": "claude-sonnet-4-6",
  "nl-search": "claude-haiku-4-5-20251001",
  "relationship-score": "claude-haiku-4-5-20251001",
  "next-best-action": "claude-sonnet-4-6",
};

// ── AI features ──────────────────────────────────────────

export type AiFeature =
  | "email-draft"
  | "nl-search"
  | "relationship-score"
  | "next-best-action";

export const AI_FEATURE_LABELS: Record<AiFeature, string> = {
  "email-draft": "AI Email Drafting",
  "nl-search": "Natural Language Search",
  "relationship-score": "Relationship Health",
  "next-best-action": "Next Best Action",
};

// ── token usage tracking ─────────────────────────────────

export interface TokenUsageEntry {
  id: string;
  timestamp: string;
  feature: AiFeature;
  model: ModelId;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  userId: string;
  durationMs: number;
  metadata?: Record<string, string>;
}

export interface UsageSummary {
  totalRequests: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCostUsd: number;
  byFeature: Record<AiFeature, {
    requests: number;
    inputTokens: number;
    outputTokens: number;
    costUsd: number;
  }>;
  periodStart: string;
  periodEnd: string;
}

export interface CostBreakdown {
  /** Direct API costs — token usage */
  apiCosts: {
    monthly: number;
    projected: number;
    byFeature: Record<AiFeature, number>;
  };
  /** Notion API calls driven by AI features */
  notionApiCosts: {
    estimatedCallsPerMonth: number;
    /** Notion free tier covers 3 integrations; this tracks calls */
    withinFreeTier: boolean;
  };
  /** Vercel serverless function execution time */
  computeCosts: {
    estimatedFunctionMs: number;
    /** Vercel Hobby = 100 GB-hrs; Pro = 1000 GB-hrs */
    estimatedGbSeconds: number;
    monthlyEstimate: number;
  };
  /** Bandwidth and storage */
  infrastructureCosts: {
    vercelBandwidthGb: number;
    r2StorageGb: number;
    monthlyEstimate: number;
  };
  /** Development and maintenance overhead */
  operationalCosts: {
    estimatedDevHoursPerMonth: number;
    maintenanceNotes: string[];
  };
  /** Total monthly estimate */
  totalMonthlyEstimate: number;
}

// ── budget ───────────────────────────────────────────────

export interface Budget {
  monthlyLimitUsd: number;
  warningThresholdPct: number;
  currentSpendUsd: number;
  remainingUsd: number;
  isOverBudget: boolean;
  isNearLimit: boolean;
}

// ── AI email drafting ────────────────────────────────────

export interface EmailDraftRequest {
  organizationId: string;
  contactId?: string;
  tone?: "professional" | "warm" | "casual" | "formal";
  purpose?: "intro" | "follow-up" | "proposal" | "check-in" | "event-invite";
  additionalContext?: string;
  senderName?: string;
}

export interface EmailDraftResponse {
  subject: string;
  body: string;
  usage: { inputTokens: number; outputTokens: number; costUsd: number };
}

// ── natural language search ──────────────────────────────

export interface NlSearchRequest {
  query: string;
  scope?: ("contacts" | "organizations")[];
}

export interface NlSearchFilters {
  contacts?: Record<string, unknown>;
  organizations?: Record<string, unknown>;
  explanation: string;
}

export interface NlSearchResponse {
  filters: NlSearchFilters;
  results: {
    contacts: Array<{ id: string; name: string; [k: string]: unknown }>;
    organizations: Array<{ id: string; organization: string; [k: string]: unknown }>;
  };
  usage: { inputTokens: number; outputTokens: number; costUsd: number };
}

// ── relationship health ──────────────────────────────────

export interface RelationshipScore {
  contactId: string;
  contactName: string;
  score: number; // 0-100
  trend: "improving" | "stable" | "declining" | "at-risk";
  factors: string[];
  lastActivityDate: string | null;
  daysSinceContact: number;
  activityCount: number;
}

export interface RelationshipScoreResponse {
  scores: RelationshipScore[];
  usage: { inputTokens: number; outputTokens: number; costUsd: number };
}

// ── next best action ─────────────────────────────────────

export interface NextAction {
  contactId?: string;
  contactName?: string;
  organizationId?: string;
  organizationName?: string;
  action: string;
  reason: string;
  priority: "high" | "medium" | "low";
  suggestedDate: string;
  channel: "email" | "call" | "meeting" | "linkedin" | "other";
}

export interface NextActionResponse {
  actions: NextAction[];
  usage: { inputTokens: number; outputTokens: number; costUsd: number };
}
