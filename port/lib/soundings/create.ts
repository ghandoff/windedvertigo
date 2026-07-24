/**
 * Soundings — creation paths.
 *
 * Two entry points share one shape:
 *   - createSoundingForRfp(): called from lib/rfp/transition.ts right after
 *     notifyDeferredRfp() posts the one-pager and setRfpSlackThread() stores
 *     the thread anchor. Idempotent (open-sounding lookup + the
 *     (channel, thread_ts) unique index).
 *   - createManualSounding(): maria/garrett kicking one off by hand for an
 *     arbitrary doc — posts its own root message to the channel first.
 *
 * Reviewer defaults follow the rfp-notify convention: SLACK_RFP_MENTION_EMAILS
 * (csv), falling back to garrett + maria. Fail-open throughout — a slack or
 * supabase hiccup never blocks the caller's transition.
 */

import type { RfpOpportunity } from "@/lib/notion/types";
import {
  insertSounding,
  getOpenSoundingForRfp,
  setKickoffMsgTs,
  type SoundingRow,
  type SoundingQuestion,
} from "@/lib/supabase/soundings";
import { addReviewers } from "@/lib/supabase/sounding-reviewers";
import { getSlackUserByEmail, postToChannelResilientDetailed } from "@/lib/slack";
import { nextWhirlpoolDeadline, deriveAgentQuestions } from "./logic";
import { postSoundingKickoff } from "./slack";

const DEFAULT_REVIEWER_EMAILS = (
  process.env.SLACK_RFP_MENTION_EMAILS ??
  "garrett@windedvertigo.com,maria@windedvertigo.com"
)
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

const DEFAULT_CHANNEL = process.env.SLACK_RFP_CHANNEL ?? "#funding-opportunities";

function portBaseUrl(): string {
  return process.env.NEXT_PUBLIC_PORT_URL ?? "https://port.windedvertigo.com";
}

async function resolveReviewers(
  emails: string[],
): Promise<Array<{ email: string; slackUserId: string | null }>> {
  return Promise.all(
    emails.map(async (email) => ({
      email,
      slackUserId: await getSlackUserByEmail(email).catch(() => null),
    })),
  );
}

/** Shared tail: insert row, attach reviewers, post the kickoff thread reply. */
async function finalizeSounding(
  entry: Parameters<typeof insertSounding>[0],
  reviewerEmails: string[],
): Promise<SoundingRow | null> {
  const sounding = await insertSounding(entry);
  if (!sounding) return null; // insert failed OR a sounding already owns this thread

  await addReviewers(sounding.id, await resolveReviewers(reviewerEmails));

  const kickoffTs = await postSoundingKickoff(sounding);
  if (kickoffTs) await setKickoffMsgTs(sounding.id, kickoffTs);

  return sounding;
}

/**
 * Create the sounding for a just-deferred RFP whose one-pager thread already
 * exists. Questions: 🤖 derived from the one-pager's open ends (deriveAgent-
 * Questions — honest provenance, no Claude call); 👤 questions arrive later
 * via the manual API when maria curates them.
 */
export async function createSoundingForRfp(
  notionPageId: string,
  opp: RfpOpportunity,
  channelId: string,
  threadTs: string,
): Promise<SoundingRow | null> {
  try {
    const existing = await getOpenSoundingForRfp(notionPageId);
    if (existing) return existing;

    return await finalizeSounding(
      {
        source: "rfp",
        rfpNotionPageId: notionPageId,
        docTitle: opp.opportunityName,
        docUrl: `${portBaseUrl()}/rfp-radar/${notionPageId}`,
        slackChannelId: channelId,
        slackThreadTs: threadTs,
        questions: deriveAgentQuestions(opp.onePager),
        deadlineAt: nextWhirlpoolDeadline(new Date()).toISOString(),
        createdBy: null,
      },
      DEFAULT_REVIEWER_EMAILS,
    );
  } catch (err) {
    console.warn("[soundings/create] createSoundingForRfp failed:", err);
    return null;
  }
}

export interface CreateManualSoundingInput {
  docTitle: string;
  docUrl?: string;
  /** channel name (#…) or ID; defaults to the rfp channel */
  channel?: string;
  reviewerEmails?: string[];
  /** 👤 questions from the requester (askedByName defaults to their email prefix) */
  questions?: Array<{ text: string; askedByName?: string }>;
  deadlineAt?: string;
  createdBy: string; // session email
}

/**
 * Manual path: post a fresh root message to the channel, then hang the
 * sounding off it. Used by POST /api/soundings.
 */
export async function createManualSounding(
  input: CreateManualSoundingInput,
): Promise<SoundingRow | null> {
  try {
    const channel = input.channel ?? DEFAULT_CHANNEL;
    const reviewerEmails = (input.reviewerEmails?.length
      ? input.reviewerEmails.map((e) => e.trim().toLowerCase()).filter(Boolean)
      : DEFAULT_REVIEWER_EMAILS);

    const askerName = input.createdBy.split("@")[0];
    const questions: SoundingQuestion[] = (input.questions ?? []).map((q) => ({
      text: q.text,
      askedByType: "human",
      askedByName: q.askedByName?.trim() || askerName,
    }));

    const rootText = [
      `🔔 *feedback wanted:* ${input.docTitle}`,
      input.docUrl ? `<${input.docUrl}|read the doc>` : null,
    ]
      .filter(Boolean)
      .join("\n");

    const root = await postToChannelResilientDetailed(channel, rootText, reviewerEmails);
    if (!root.posted || !root.ts) {
      console.warn("[soundings/create] manual root post failed — no sounding created");
      return null;
    }

    return await finalizeSounding(
      {
        source: "manual",
        rfpNotionPageId: null,
        docTitle: input.docTitle,
        docUrl: input.docUrl ?? null,
        slackChannelId: root.resolvedChannel ?? channel,
        slackThreadTs: root.ts,
        questions,
        deadlineAt: input.deadlineAt ?? nextWhirlpoolDeadline(new Date()).toISOString(),
        createdBy: input.createdBy.toLowerCase(),
      },
      reviewerEmails,
    );
  } catch (err) {
    console.warn("[soundings/create] createManualSounding failed:", err);
    return null;
  }
}
