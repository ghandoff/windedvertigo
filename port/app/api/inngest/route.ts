/**
 * Inngest serve handler — registers all port background functions with Inngest.
 *
 * Inngest's cloud POSTs to this endpoint to deliver events.
 * The function runs inside this Vercel deployment with full env access.
 *
 * Required env vars (set in Vercel):
 *   INNGEST_EVENT_KEY   — used by inngest.send() to publish events
 *   INNGEST_SIGNING_KEY — used here to verify Inngest's inbound requests
 */

import { serve } from "inngest/next";
import { inngest } from "@/lib/inngest/client";
import { generateProposalFunction, generateProposalFailureHandler } from "@/lib/inngest/functions/generate-proposal";
import { bdAssetHealthFunction } from "@/lib/inngest/functions/bd-asset-health";
import { submissionFollowupFunction } from "@/lib/inngest/functions/submission-followup";
import { parseRfpQuestionsFunction } from "@/lib/inngest/functions/parse-rfp-questions";
import { timesheetNotificationFunction } from "@/lib/inngest/functions/timesheet-notifications";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    generateProposalFunction,
    generateProposalFailureHandler,
    bdAssetHealthFunction,
    submissionFollowupFunction,
    parseRfpQuestionsFunction,
    timesheetNotificationFunction,
  ],
});
