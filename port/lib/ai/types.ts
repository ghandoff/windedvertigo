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
  "org-enrichment": "claude-haiku-4-5-20251001",
  // Haiku: high-volume (every email + RSS item), cost-sensitive
  "rfp-triage": "claude-haiku-4-5-20251001",
  // Sonnet: complex multi-source synthesis, infrequent (5-20 RFPs/month)
  "proposal-generation": "claude-sonnet-4-6",
  // Haiku: document extraction — fast, cost-effective for structured extraction
  "rfp-document-extraction": "claude-haiku-4-5-20251001",
  "rfp-question-parse": "claude-haiku-4-5-20251001",
  // Haiku: fast relevance ranking over ~200 bibliography entries
  "citation-matching": "claude-haiku-4-5-20251001",
  // Sonnet: structured task decomposition from project briefs
  "task-generation": "claude-sonnet-4-6",
  // Haiku: quick extraction of action items from meeting notes
  "meeting-actions": "claude-haiku-4-5-20251001",
  // Haiku: weekly summary of project status — low-cost, high-volume text
  "weekly-digest": "claude-haiku-4-5-20251001",
  // Haiku: per-conference fit-scoring + structured extraction. Discovery
  // pipeline runs many of these per cron, so cost-sensitive choice.
  "conference-triage": "claude-haiku-4-5-20251001",
  // Haiku: cARL's scheduled curriculum study — cheap, runs a few topics/week.
  "carl-study": "claude-haiku-4-5-20251001",
  // Sonnet: cARL's on-demand deep research — infrequent, depth matters.
  "carl-research": "claude-sonnet-4-6",
  // Haiku: parse a document's reference list into structured citations.
  "bibliography-import": "claude-haiku-4-5-20251001",
  // Haiku: classify infrastructure notification emails (Opsy) — high volume,
  // short outputs, cost-sensitive.
  "opsy-email-triage": "claude-haiku-4-5-20251001",
  // Haiku: Opsy's weekly ops digest — one short summary per week.
  "opsy-digest": "claude-haiku-4-5-20251001",
  // Haiku: triage meeting action items into PaM commitments — meaningfulness,
  // cycle/type/priority suggestion, dedup vs existing commitments. Cheap, runs
  // over a batch of new action items per cron.
  "pam-action-triage": "claude-haiku-4-5-20251001",
  // Haiku: extract referenced concepts/skills from agent freeform logs
  // (findings, decisions, incidents) for the /brain knowledge graph. Batched.
  "knowledge-extract": "claude-haiku-4-5-20251001",
  // Haiku: adjudicate whether a human CV capability and an agent-observed concept
  // name the same thing (fuzzy /brain reconciliation). Batched, cached per pair.
  "knowledge-reconcile": "claude-haiku-4-5-20251001",
  // Sonnet: TToC alignment scoring — a judgment call worth spending on, called
  // on-demand (go/no-go review, commitment intake), not high-volume.
  "ttoc-gate": "claude-sonnet-4-6",
};

// ── AI features ──────────────────────────────────────────

export type AiFeature =
  | "email-draft"
  | "nl-search"
  | "relationship-score"
  | "next-best-action"
  | "org-enrichment"
  | "rfp-triage"
  | "proposal-generation"
  | "rfp-document-extraction"
  | "rfp-question-parse"
  | "citation-matching"
  | "task-generation"
  | "meeting-actions"
  | "weekly-digest"
  | "conference-triage"
  | "carl-study"
  | "carl-research"
  | "bibliography-import"
  | "opsy-email-triage"
  | "opsy-digest"
  | "pam-action-triage"
  | "knowledge-extract"
  | "knowledge-reconcile"
  | "ttoc-gate";

export const AI_FEATURE_LABELS: Record<AiFeature, string> = {
  "email-draft": "AI Email Drafting",
  "nl-search": "Natural Language Search",
  "relationship-score": "Relationship Health",
  "next-best-action": "Next Best Action",
  "org-enrichment": "Org Enrichment",
  "rfp-triage": "RFP Triage",
  "proposal-generation": "Proposal Generation",
  "rfp-document-extraction": "RFP Document Extraction",
  "rfp-question-parse": "RFP Question Parser",
  "citation-matching": "Citation Matching",
  "task-generation": "Task Generation",
  "meeting-actions": "Meeting Action Items",
  "weekly-digest": "Weekly Status Digest",
  "conference-triage": "Conference Triage",
  "carl-study": "cARL Scheduled Study",
  "carl-research": "cARL Deep Research",
  "bibliography-import": "Bibliography Import",
  "opsy-email-triage": "Opsy Email Triage",
  "opsy-digest": "Opsy Weekly Digest",
  "pam-action-triage": "PaM Action Triage",
  "knowledge-extract": "Knowledge Graph Extract",
  "knowledge-reconcile": "Knowledge Graph Reconcile",
  "ttoc-gate": "TToC Alignment Gate",
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

// ── org enrichment ───────────────────────────────────────

export type EmployeeSizeBand = "1-10" | "11-50" | "51-200" | "201-1000" | "1000+";

export interface OrgEnrichmentExtracted {
  description: string | null;
  linkedinUrl: string | null;
  employeeSize: EmployeeSizeBand | null;
  foundedYear: number | null;
}

export interface OrgEnrichmentResult {
  orgId: string;
  logo: string | null;
  extracted: OrgEnrichmentExtracted;
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
