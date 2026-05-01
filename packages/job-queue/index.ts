/**
 * @windedvertigo/job-queue
 *
 * Shared Cloudflare Queues + Durable Objects utilities for wv CF Worker apps.
 * Used by: port (proposal generation), nordic (workflow jobs), future apps.
 *
 * Runtime: Cloudflare Workers only. For types in Node.js environments,
 * import from "@windedvertigo/job-queue/types" instead.
 */

export type {
  RfpProposalJob,
  TimesheetStatusJob,
  JobPayload,
  JobResult,
  JobHandler,
  QueueBindings,
  JobDurableObjectState,
} from "./types";

// ── Queue publisher ───────────────────────────────────────────────

/**
 * Publish a job to a CF Queue binding.
 *
 * @example
 * await publishJob(env.PROPOSAL_QUEUE, {
 *   type: "rfp/generate-proposal",
 *   rfpId: "abc123",
 *   triggeredBy: "garrett@windedvertigo.com",
 *   requestedAt: new Date().toISOString(),
 * });
 */
/** Duck-typed interface — compatible with CF `Queue<T>` at runtime. */
interface QueueLike<T> {
  send(payload: T, options?: unknown): Promise<void>;
}

/** Duck-typed message interface — compatible with CF `Message<T>` at runtime. */
interface MessageLike<T> {
  readonly body: T;
  ack(): void;
  retry(options?: unknown): void;
}

/** Duck-typed batch interface — compatible with CF `MessageBatch<T>` at runtime. */
interface MessageBatchLike<T> {
  readonly queue: string;
  readonly messages: ReadonlyArray<MessageLike<T>>;
}

export async function publishJob<T>(
  queue: QueueLike<T>,
  payload: T,
  options?: unknown,
): Promise<void> {
  await queue.send(payload, options);
}

// ── Consumer wrapper ──────────────────────────────────────────────

/**
 * Standardized queue consumer that:
 * - Processes each message with the provided handler
 * - On success: marks message as acknowledged
 * - On failure: retries up to maxRetries, then moves to DLQ
 *
 * @example
 * // In your Worker's queue() export:
 * export default {
 *   queue: createQueueConsumer(handleProposalJob),
 * };
 */
export function createQueueConsumer<T>(
  handler: (payload: T, env: Record<string, unknown>) => Promise<{ success: boolean; error?: string }>,
): (batch: MessageBatchLike<T>, env: Record<string, unknown>) => Promise<void> {
  return async (batch, env) => {
    for (const message of batch.messages) {
      try {
        const result = await handler(message.body, env);
        if (result.success) {
          message.ack();
        } else {
          // Non-success but no thrown error → retry
          console.error(`[job-queue] job failed (will retry):`, result.error);
          message.retry();
        }
      } catch (err) {
        console.error(`[job-queue] job threw (will retry):`, err);
        message.retry();
      }
    }
  };
}

// ── Retry config helpers ──────────────────────────────────────────

/** Standard retry config for proposal generation jobs (long timeout, few retries). */
export const PROPOSAL_QUEUE_CONSUMER_CONFIG = {
  maxRetries: 3,
  retryDelay: { initialDelay: 30 }, // 30s → 60s → 120s exponential
};

/** Standard retry config for lightweight status-change jobs. */
export const STATUS_QUEUE_CONSUMER_CONFIG = {
  maxRetries: 5,
  retryDelay: { initialDelay: 5 },
};
