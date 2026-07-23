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

import type { RfpProposalJob, TimesheetStatusJob, RfpDocumentUploadedJob, DocumentAudioJob } from "@windedvertigo/job-queue/types";

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
    LISTEN_QUEUE: QueueSender<DocumentAudioJob>;
    PORT_ASSETS: {
      put(key: string, body: unknown, options?: unknown): Promise<void>;
      get(key: string): Promise<{
        body: ReadableStream;
        text(): Promise<string>;
        httpMetadata?: { contentType?: string };
        size?: number;
      } | null>;
      delete(key: string): Promise<void>;
    };
    /**
     * CF Browser Rendering binding.
     * Present only when the Browser Rendering add-on is enabled.
     * cover-image.ts checks for its presence before calling puppeteer.launch().
     */
    BROWSER?: {
      fetch(request: Request): Promise<Response>;
    };
    /** OAuth bookkeeping for the agents' MCP connector — clients + one-time codes. */
    OAUTH_KV: {
      get(key: string, type: "json"): Promise<unknown>;
      put(key: string, value: string, opts?: { expirationTtl?: number }): Promise<void>;
      delete(key: string): Promise<void>;
    };
    PORT_URL: string;
    CRON_SECRET: string;
  }
}

// Re-export for any code that still imports PortCfEnv by name.
export type PortCfEnv = CloudflareEnv;
