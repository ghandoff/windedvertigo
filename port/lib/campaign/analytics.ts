/**
 * Campaign analytics — single source of truth for the funnel/step numbers.
 *
 * Both the /api/campaigns/[id]/analytics route and the
 * /campaigns/[id]/analytics page render from this function, so the numbers
 * shown in the UI and the numbers returned by the API always agree.
 *
 * Key design decision: funnel stages are counted in UNIQUE ORGS, not in
 * raw draft rows. A 13-org audience that fans out to ~53 contact drafts
 * should show `contacted: 13`, not `sent: 53`. The raw draft count is
 * still exposed as `rawEmailsSent` for completeness.
 *
 * This prevents the "sent 408%" / "opened 123%" nonsense that happens
 * when drafts (which fan out per-contact) are divided by audience
 * (which is counted per-org).
 */

import { getCampaign } from "@/lib/notion/campaigns";
import { getStepsForCampaign } from "@/lib/notion/campaign-steps";
import { resolveAudience } from "@/lib/notion/audience";
import {
  queryEmailDraftsByCampaign,
  queryEmailDraftsByStep,
} from "@/lib/notion/email-drafts";
import type { EmailDraft, StepStatus, StepChannel } from "@/lib/notion/types";

export interface CampaignAnalytics {
  campaign: {
    id: string;
    name: string;
    status: string;
    type: string;
  };
  funnel: {
    /** Unique orgs in the resolved audience. */
    audience: number;
    /** Unique orgs that received at least one sent draft. */
    contacted: number;
    /** Unique orgs where at least one draft recorded a human open. */
    opened: number;
    /** Unique orgs where at least one draft recorded a click. */
    clicked: number;
    /** Total number of sent draft rows (email events). Not unique-org. */
    rawEmailsSent: number;
    /** Total emails that failed to send. */
    failed: number;
    /** Unique orgs whose only opens are machine-filtered (Apple MPP etc). */
    machineOnly: number;
    /** Sum of machine-open events across all sent drafts. */
    machineOpens: number;
    /** Average contacts-per-org (fan-out factor). */
    contactsPerOrg: number;
    /** `opened / contacted`, 0-100, rounded. */
    openRate: number;
    /** `clicked / contacted`, 0-100, rounded. */
    clickRate: number;
    /** `clicked / opened`, 0-100, rounded. */
    clickToOpenRate: number;
    /** Raw event totals for tooltips. */
    totalOpenEvents: number;
    totalClickEvents: number;
  };
  steps: StepAnalytics[];
}

export interface StepAnalytics {
  id: string;
  name: string;
  channel: StepChannel;
  status: StepStatus;
  sendDate: string | null;
  /** Unique orgs contacted by this step. */
  contacted: number;
  /** Unique orgs that opened at least one draft of this step. */
  opened: number;
  /** Unique orgs that clicked at least one draft of this step. */
  clicked: number;
  /** Raw sent drafts for this step (includes contact fan-out). */
  rawEmailsSent: number;
  /** Skipped count, if recorded on the step record. */
  skipped: number;
  openRate: number;
  clickRate: number;
}

/**
 * Fetch + compute all campaign analytics in one call.
 * Paginates drafts via the underlying queryEmailDraftsByCampaign helper.
 */
export async function computeCampaignAnalytics(
  campaignId: string,
): Promise<CampaignAnalytics> {
  const [campaign, steps, drafts] = await Promise.all([
    getCampaign(campaignId),
    getStepsForCampaign(campaignId),
    queryEmailDraftsByCampaign(campaignId),
  ]);

  const hasFilters =
    campaign.audienceFilters &&
    Object.keys(campaign.audienceFilters).length > 0;
  const audienceOrgs = hasFilters
    ? await resolveAudience(campaign.audienceFilters)
    : [];

  const funnel = buildFunnel(audienceOrgs.length, drafts);

  // Per-step funnel — use the stepId relation on drafts (the correct join),
  // not the old date-based match.
  const draftsByStep = new Map<string, EmailDraft[]>();
  for (const d of drafts) {
    if (!d.stepId) continue;
    const arr = draftsByStep.get(d.stepId) ?? [];
    arr.push(d);
    draftsByStep.set(d.stepId, arr);
  }

  // Some older drafts may lack a stepId relation. Fall back to querying
  // by stepId relation directly only if we got nothing from the map —
  // this handles the rare case of drafts backfilled before stepId was
  // populated. Cheap because single-campaign datasets are small.
  const stepAnalytics: StepAnalytics[] = await Promise.all(
    steps.map(async (step) => {
      let stepDrafts = draftsByStep.get(step.id);
      if (!stepDrafts || stepDrafts.length === 0) {
        // Fallback — handles historical drafts missing the stepId relation.
        stepDrafts = await queryEmailDraftsByStep(step.id);
      }

      const stepFunnel = buildStepFunnel(stepDrafts);
      return {
        id: step.id,
        name: step.name,
        channel: step.channel,
        status: step.status,
        sendDate: step.sendDate?.start ?? null,
        contacted: stepFunnel.contacted,
        opened: stepFunnel.opened,
        clicked: stepFunnel.clicked,
        rawEmailsSent: stepFunnel.rawEmailsSent,
        skipped: step.skippedCount ?? 0,
        openRate: stepFunnel.openRate,
        clickRate: stepFunnel.clickRate,
      };
    }),
  );

  return {
    campaign: {
      id: campaign.id,
      name: campaign.name,
      status: campaign.status,
      type: campaign.type,
    },
    funnel,
    steps: stepAnalytics,
  };
}

// ── helpers ─────────────────────────────────────────────────────

function buildFunnel(
  audienceSize: number,
  drafts: EmailDraft[],
): CampaignAnalytics["funnel"] {
  const sentDrafts = drafts.filter((d) => d.status === "sent");
  const failedDrafts = drafts.filter((d) => d.status === "failed");

  const orgsContacted = uniqueOrgs(sentDrafts);
  const orgsOpened = uniqueOrgs(
    sentDrafts.filter((d) => d.opens > 0),
  );
  const orgsClicked = uniqueOrgs(
    sentDrafts.filter((d) => d.clicks > 0),
  );
  const orgsMachineOnly = uniqueOrgs(
    sentDrafts.filter((d) => d.opens === 0 && d.machineOpens > 0),
  );

  const totalOpenEvents = sentDrafts.reduce((s, d) => s + d.opens, 0);
  const totalClickEvents = sentDrafts.reduce((s, d) => s + d.clicks, 0);
  const totalMachineOpens = sentDrafts.reduce(
    (s, d) => s + d.machineOpens,
    0,
  );

  const openRate = pct(orgsOpened.size, orgsContacted.size);
  const clickRate = pct(orgsClicked.size, orgsContacted.size);
  const clickToOpenRate = pct(orgsClicked.size, orgsOpened.size);

  return {
    audience: audienceSize,
    contacted: orgsContacted.size,
    opened: orgsOpened.size,
    clicked: orgsClicked.size,
    rawEmailsSent: sentDrafts.length,
    failed: failedDrafts.length,
    machineOnly: orgsMachineOnly.size,
    machineOpens: totalMachineOpens,
    contactsPerOrg:
      orgsContacted.size > 0
        ? Math.round((sentDrafts.length / orgsContacted.size) * 10) / 10
        : 0,
    openRate,
    clickRate,
    clickToOpenRate,
    totalOpenEvents,
    totalClickEvents,
  };
}

function buildStepFunnel(drafts: EmailDraft[]) {
  const sentDrafts = drafts.filter((d) => d.status === "sent");
  const orgsContacted = uniqueOrgs(sentDrafts);
  const orgsOpened = uniqueOrgs(sentDrafts.filter((d) => d.opens > 0));
  const orgsClicked = uniqueOrgs(sentDrafts.filter((d) => d.clicks > 0));
  return {
    contacted: orgsContacted.size,
    opened: orgsOpened.size,
    clicked: orgsClicked.size,
    rawEmailsSent: sentDrafts.length,
    openRate: pct(orgsOpened.size, orgsContacted.size),
    clickRate: pct(orgsClicked.size, orgsContacted.size),
  };
}

function uniqueOrgs(drafts: EmailDraft[]): Set<string> {
  const set = new Set<string>();
  for (const d of drafts) {
    if (d.organizationId) set.add(d.organizationId);
  }
  return set;
}

function pct(num: number, denom: number): number {
  if (denom <= 0) return 0;
  return Math.min(100, Math.round((num / denom) * 100));
}
