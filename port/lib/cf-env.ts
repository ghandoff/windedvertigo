/**
 * Cloudflare Worker env bindings for port API routes.
 *
 * Augments the OpenNext `CloudflareEnv` global interface so that
 * `getCloudflareContext().env` is automatically typed with port-specific
 * queue and R2 bindings — no explicit generic arg needed in route handlers.
 *
 * Uses duck-typed sender interfaces (no @cloudflare/workers-types dependency)
 * so this file compiles cleanly in both Next.js and CF Workers contexts.
 */

import type { RfpProposalJob, TimesheetStatusJob, RfpDocumentUploadedJob } from "@windedvertigo/job-queue/types";

/** Minimal queue sender interface compatible with CF Queue<T> at runtime. */
interface QueueSender<T> {
  send(payload: T, options?: unknown): Promise<void>;
}

/**
 * Augment the OpenNext CloudflareEnv global with port-specific bindings.
 * After this import, `getCloudflareContext().env` includes all fields below.
 */
declare global {
  interface CloudflareEnv {
    PROPOSAL_QUEUE: QueueSender<RfpProposalJob>;
    TIMESHEET_QUEUE: QueueSender<TimesheetStatusJob>;
    RFP_DOCUMENT_QUEUE: QueueSender<RfpDocumentUploadedJob>;
    PORT_ASSETS: {
      put(key: string, body: unknown, options?: unknown): Promise<void>;
    };
    PORT_URL: string;
    CRON_SECRET: string;
  }
}

// Re-export for any code that still imports PortCfEnv by name.
export type PortCfEnv = CloudflareEnv;
