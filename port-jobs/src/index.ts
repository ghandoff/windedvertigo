/**
 * @windedvertigo/port-jobs — CF Queue Consumer Worker
 *
 * Processes all job queues for wv-port. Single worker consumes three queues,
 * routing by batch.queue name to the appropriate handler.
 *
 * Queues consumed:
 *   wv-port-proposal-queue     → handleProposalJob
 *   wv-port-timesheet-queue    → handleTimesheetJob
 *   wv-port-rfp-document-queue → handleRfpDocumentJob
 *
 * Migration status:
 *   ✅ Scaffold + routing — done
 *   🔵 G.2.2 — migrate handlers from port/lib/inngest/functions/ (post Phase A.2)
 */

import { createQueueConsumer } from "@windedvertigo/job-queue";
import type {
  RfpProposalJob,
  TimesheetStatusJob,
  RfpDocumentUploadedJob,
} from "@windedvertigo/job-queue/types";

// ── Env type ─────────────────────────────────────────────────────────────────
// Matches secrets declared in wrangler.jsonc. Run `wrangler cf-typegen` to
// generate the full type from live bindings once the worker is deployed.

export interface Env {
  // Secrets
  ANTHROPIC_API_KEY: string;
  RESEND_API_KEY: string;
  SLACK_BOT_TOKEN: string;
  NOTION_TOKEN: string;
  SUPABASE_URL: string;
  SUPABASE_SERVICE_KEY: string;

  // R2
  PORT_ASSETS: R2Bucket;
}

// ── Queue name constants ──────────────────────────────────────────────────────

const QUEUE_PROPOSAL = "wv-port-proposal-queue";
const QUEUE_TIMESHEET = "wv-port-timesheet-queue";
const QUEUE_RFP_DOCUMENT = "wv-port-rfp-document-queue";

// ── Handlers (TODO G.2.2: migrate from port/lib/inngest/functions/) ───────────

/**
 * Proposal generation consumer.
 *
 * Migrated from: port/lib/inngest/functions/generate-proposal.ts
 *
 * Key migration notes (see plan Phase G.2):
 *   - Remove step.run("generate-draft", ...) at original line 310
 *   - Remove generateProposalFailureHandler (inngest/function.failed) —
 *     DLQ handling is now automatic via CF Queues after maxRetries exhausted
 *   - Preserve parallel context fetch (org, activities, bdAssets, citations, rateRefs)
 *   - Restructure as: fetch all context → single Claude call → write all output
 *   - On completion: UPDATE rfp_opportunities SET proposal_status='ready-for-review'
 *   - On error: UPDATE rfp_opportunities SET proposal_status='failed'
 */
const proposalConsumer = createQueueConsumer<RfpProposalJob>(
  async (_payload, _env) => {
    // TODO G.2.2
    throw new Error(
      "handleProposalJob not yet implemented — pending Phase A.2 (port nested-clone resolution)",
    );
  },
);

/**
 * Timesheet status notification consumer.
 *
 * Migrated from: port/lib/inngest/functions/timesheet-notifications.ts
 *
 * Steps (straightforward — no step.run() in original):
 *   1. Fetch timesheet from Notion
 *   2. Look up submitter email
 *   3. Send email via Resend
 *   4. Post Slack notification
 */
const timesheetConsumer = createQueueConsumer<TimesheetStatusJob>(
  async (_payload, _env) => {
    // TODO G.2.2
    throw new Error(
      "handleTimesheetJob not yet implemented — pending Phase A.2",
    );
  },
);

/**
 * RFP document parsing consumer.
 *
 * Migrated from: port/lib/inngest/functions/parse-rfp-questions.ts
 *
 * Steps:
 *   1. Fetch document from R2 (URL in payload)
 *   2. Pass 1: Claude extracts questions from RFP text
 *   3. Pass 2: Claude matches questions to org capabilities + drafts answers
 *   4. Upload parsed JSON to R2 PORT_ASSETS
 *   5. Update Notion RFP page with parsed questions block
 *
 * contentType routing: "text/plain" skips PDF extraction step
 */
const rfpDocumentConsumer = createQueueConsumer<RfpDocumentUploadedJob>(
  async (_payload, _env) => {
    // TODO G.2.2
    throw new Error(
      "handleRfpDocumentJob not yet implemented — pending Phase A.2",
    );
  },
);

// ── Worker export ─────────────────────────────────────────────────────────────

export default {
  async queue(
    batch: MessageBatch,
    env: Env,
    _ctx: ExecutionContext,
  ): Promise<void> {
    switch (batch.queue) {
      case QUEUE_PROPOSAL:
        await proposalConsumer(batch as MessageBatch<RfpProposalJob>, env as unknown as Record<string, unknown>);
        break;
      case QUEUE_TIMESHEET:
        await timesheetConsumer(batch as MessageBatch<TimesheetStatusJob>, env as unknown as Record<string, unknown>);
        break;
      case QUEUE_RFP_DOCUMENT:
        await rfpDocumentConsumer(batch as MessageBatch<RfpDocumentUploadedJob>, env as unknown as Record<string, unknown>);
        break;
      default:
        console.error(`[port-jobs] unknown queue: ${batch.queue}`);
        // Ack all messages to avoid infinite retry on unknown queue
        batch.ackAll();
    }
  },
} satisfies ExportedHandler<Env>;
