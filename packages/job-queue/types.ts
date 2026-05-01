/**
 * @windedvertigo/job-queue — shared types
 *
 * Import from "@windedvertigo/job-queue/types" in any environment
 * (Node.js, CF Workers, tests) — no CF-specific runtime APIs here.
 */

// ── Job payload shapes ────────────────────────────────────────────

export interface RfpProposalJob {
  type: "rfp/generate-proposal";
  rfpId: string;
  triggeredBy: string; // email of the user who triggered generation
  requestedAt: string; // ISO timestamp
}

export interface TimesheetStatusJob {
  type: "timesheet/status-changed";
  timesheetId: string;
  newStatus: string;
  previousStatus?: string;
  approverEmail: string;
  changedAt: string; // ISO timestamp
}

export interface RfpDocumentUploadedJob {
  type: "rfp/document-uploaded";
  rfpId: string;
  documentUrl: string;
  contentType: string; // "text/plain" | "application/pdf"
  uploadedAt: string; // ISO timestamp
}

/** Union of all job payload shapes. Add new job types here. */
export type JobPayload = RfpProposalJob | TimesheetStatusJob | RfpDocumentUploadedJob;

// ── Consumer / handler types ──────────────────────────────────────

/** Result returned by a queue consumer handler. */
export interface JobResult {
  success: boolean;
  /** Written to Supabase as job outcome. */
  message?: string;
  /** If set, surfaces to the DLQ after maxRetries exhausted. */
  error?: string;
}

/** Type for a queue message handler function. */
export type JobHandler<T extends JobPayload = JobPayload> = (
  payload: T,
  env: Record<string, unknown>,
) => Promise<JobResult>;

// ── Queue binding types (CF Workers env) ─────────────────────────

/**
 * Minimal duck-typed queue sender — structurally compatible with CF `Queue<T>`
 * at runtime without requiring @cloudflare/workers-types in non-CF contexts.
 */
interface QueueSender<T> {
  send(payload: T, options?: unknown): Promise<void>;
}

export interface QueueBindings {
  /** CF Queue binding — injected by wrangler at runtime. */
  PROPOSAL_QUEUE: QueueSender<RfpProposalJob>;
  TIMESHEET_QUEUE: QueueSender<TimesheetStatusJob>;
  RFP_DOCUMENT_QUEUE: QueueSender<RfpDocumentUploadedJob>;
}

// ── Cron function signatures (for CF scheduled() handler) ─────────

/**
 * Duck-typed CF `ScheduledController` — compatible with the CF Workers runtime
 * object without requiring @cloudflare/workers-types.
 */
interface ScheduledControllerLike {
  readonly scheduledTime: number;
  readonly cron: string;
  noRetry(): void;
}

/**
 * Duck-typed CF `ExecutionContext` — compatible with the CF Workers runtime
 * object without requiring @cloudflare/workers-types.
 */
interface ExecutionContextLike {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

/**
 * Functions that were Inngest cron-triggered are mapped to CF Worker
 * scheduled() handlers. These fire on the same UTC schedule via
 * wrangler.jsonc `cron_triggers`.
 *
 * submission-followup → cron: "0 8 * * *"   (daily 8am UTC)
 * bd-asset-health     → cron: "0 9 * * 1"   (Monday 9am UTC)
 */
export type ScheduledHandler = (controller: ScheduledControllerLike, env: QueueBindings & Record<string, unknown>, ctx: ExecutionContextLike) => Promise<void>;

// ── Durable Object base types ─────────────────────────────────────

export interface JobDurableObjectState {
  jobId: string;
  status: "pending" | "running" | "done" | "failed";
  startedAt: string;
  completedAt?: string;
  retryCount: number;
}
