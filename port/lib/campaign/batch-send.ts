/**
 * Batch email send logic for campaign steps.
 *
 * Sends emails to all orgs in an audience, batched 10 at a time to respect
 * Resend rate limits. Creates EmailDraft records and updates outreach status.
 *
 * Contact fan-out: if an org has linked contacts with email addresses, we send
 * a personalised email to each contact individually (using their own email +
 * {{contactName}}). If no linked contacts exist we fall back to org.email.
 */

import { sendOutreachEmail } from "@/lib/email/resend";
import { buildEmailHtml, htmlToPlainText } from "@/lib/email/templates";
import { buildUnsubscribeUrl, buildViewInBrowserUrl } from "@/lib/email/unsubscribe";
import { createEmailDraft, updateEmailDraft, queryEmailDraftsByStep } from "@/lib/notion/email-drafts";
import { createActivity } from "@/lib/notion/activities";
import { createSocialDraft } from "@/lib/notion/social";
import { updateOutreachStatus, updateConnection } from "@/lib/notion/organizations";
import { getContact } from "@/lib/notion/contacts";
import { resolveTemplateVars, type TemplateContext } from "./template-vars";
import { rehostImages } from "@/lib/email/rehost-images";
import { tagLinksWithUtm, buildEmailUtmParams } from "./utm";
import type { Organization, Contact, SocialPlatform, EmailDraftStatus } from "@/lib/notion/types";

/**
 * Resend rate limit is 5 req/sec. We pace sends at one every 250 ms (≤4/sec)
 * to stay safely under the limit regardless of how many contacts an org has.
 */
const SEND_DELAY_MS = 250;

/** Concurrent Notion writes for social draft creation (not rate-limited like Resend). */
const SOCIAL_BATCH_SIZE = 10;

// ── conditional branching ────────────────────────────────

export interface StepCondition {
  previousStep?: "opened" | "clicked" | "notOpened" | "notClicked";
}

/**
 * Filter audience based on engagement with a previous step.
 * Queries EmailDraft records directly by stepId — no pageSize cap,
 * no audience re-resolution, no false positives from orgs in other campaigns.
 */
export async function filterByCondition(
  orgs: Organization[],
  condition: StepCondition,
  previousStepId?: string,
): Promise<Organization[]> {
  if (!condition.previousStep || !previousStepId) return orgs;

  // Fetch all drafts for the specific previous step (auto-paginated, no cap)
  const drafts = await queryEmailDraftsByStep(previousStepId);

  // Build sets of org IDs that had engagement on that step
  const orgIdsWithOpens = new Set<string>();
  const orgIdsWithClicks = new Set<string>();
  for (const draft of drafts) {
    if (draft.opens > 0) orgIdsWithOpens.add(draft.organizationId);
    if (draft.clicks > 0) orgIdsWithClicks.add(draft.organizationId);
  }

  switch (condition.previousStep) {
    case "opened":
      return orgs.filter((o) => orgIdsWithOpens.has(o.id));
    case "notOpened":
      return orgs.filter((o) => !orgIdsWithOpens.has(o.id));
    case "clicked":
      return orgs.filter((o) => orgIdsWithClicks.has(o.id));
    case "notClicked":
      return orgs.filter((o) => !orgIdsWithClicks.has(o.id));
    default:
      return orgs;
  }
}

// ── send target ───────────────────────────────────────────

/**
 * A single addressable recipient:
 *   - org-fan-out:        { org, contact }  — contact linked to an audience org
 *   - org-only fallback:  { org }           — no contacts linked, use org.email
 *   - contact-only:       { org: null, contact } — directly-added contact (org
 *                           may be fetched from contact.organizationIds for ctx)
 */
interface SendTarget {
  org: Organization | null;
  contact?: Contact;
}

// ── single email ──────────────────────────────────────────

async function sendSingleEmail(
  org: Organization | null,
  subject: string,
  body: string,
  senderName: string,
  campaignName?: string,
  variant?: "a" | "b",
  contact?: Contact,
  campaignId?: string,
  stepId?: string,
  /** Pre-rehosted template body — if provided, skip per-email rehostImages call. */
  preRehostedBody?: string,
  /**
   * If a draft row already exists for this (campaign, step, org, contact) from a prior
   * send attempt (stuck "sending" / "failed" / etc.), reuse it instead of creating a new
   * one. This is the dedup path — prevents drafts accumulating on every re-run of a step.
   */
  existingDraftId?: string,
): Promise<"sent" | "skipped"> {
  const toEmail = contact?.email || org?.email;
  if (!toEmail) return "skipped";

  // Use org ID when available; fall back to contact's first org for tracking
  const orgId = org?.id ?? contact?.organizationIds?.[0] ?? "";
  const unsubscribeUrl = buildUnsubscribeUrl(orgId || contact?.id || "unknown");

  // Resolve draft row — either reuse an existing one (dedup retry) or create fresh.
  let draft: { id: string } | null = null;
  if (existingDraftId) {
    // Reset the row back to a clean "sending" state; leave opens/clicks history alone.
    await updateEmailDraft(existingDraftId, {
      subject: "pending",
      status: "sending",
      sentAt: new Date().toISOString(),
    }).catch(() => { /* best-effort; proceed to actual send */ });
    draft = { id: existingDraftId };
  } else if (orgId) {
    // Fresh send — skip create if no orgId to avoid Notion relation error.
    draft = await createEmailDraft({
      subject: "pending",
      body: "",
      status: "sending",
      organizationId: orgId,
      contactId: contact?.id ?? null,
      sentTo: toEmail,
      campaignId: campaignId ?? null,
      stepId: stepId ?? null,
      sentAt: new Date().toISOString(),
      opens: 0,
      clicks: 0,
    });
  }
  const viewInBrowserUrl = draft ? buildViewInBrowserUrl(draft.id) : "";

  const ctx: TemplateContext = {
    orgName: org?.organization ?? "",
    contactName: contact?.name,
    firstName: contact?.name?.split(" ")[0] || org?.organization?.split(" ")[0] || "",
    senderName,
    orgEmail: toEmail,
    orgWebsite: org?.website,
    bespokeEmailCopy: org?.bespokeEmailCopy,
    outreachSuggestion: org?.outreachSuggestion,
    unsubscribeUrl,
    viewInBrowserUrl: viewInBrowserUrl || undefined,
  };

  const resolvedSubject = resolveTemplateVars(subject, ctx);
  // Apply template vars to the pre-rehosted template (images already on R2), or
  // rehost per-email if no pre-rehosted template was provided.
  const resolvedBody = resolveTemplateVars(preRehostedBody ?? body, ctx);
  const rehostedBody = preRehostedBody ? resolvedBody : await rehostImages(resolvedBody);
  let html = buildEmailHtml(rehostedBody, { orgName: org?.organization ?? "", senderName, unsubscribeUrl, viewInBrowserUrl });
  const text = htmlToPlainText(resolvedBody);

  if (campaignName) {
    html = tagLinksWithUtm(html, buildEmailUtmParams(campaignName, variant, orgId || undefined));
  }

  const sendResult = await sendOutreachEmail({
    to: toEmail,
    subject: resolvedSubject,
    html,
    text,
    tags: [
      ...(orgId ? [{ name: "org_id", value: orgId }] : []),
      { name: "send_via", value: "campaign" },
    ],
  });

  if (sendResult.error) {
    if (draft) await updateEmailDraft(draft.id, { subject: resolvedSubject, body: resolvedBody, status: "failed" }).catch(() => {});
    throw new Error(`Resend error: ${sendResult.error.message}`);
  }

  const resendMessageId = sendResult.data?.id ?? "";

  if (draft) {
    await updateEmailDraft(draft.id, { subject: resolvedSubject, body: resolvedBody, status: "sent", resendMessageId });
  }

  // Advance outreach status / connection only when we have the full org record
  if (org) {
    if (!org.outreachStatus || org.outreachStatus === "Not started" || org.outreachStatus === "Researching") {
      await updateOutreachStatus(org.id, "Contacted");
    }
    if (org.connection === "unengaged" || org.connection === "exploring") {
      await updateConnection(org.id, "in progress");
    }
  }

  // Auto-log activity
  const contactIdForLog = contact?.id ?? org?.contactIds?.[0];
  if (contactIdForLog) {
    try {
      await createActivity({
        activity: `campaign email: ${resolvedSubject}`,
        type: "email sent",
        contactIds: [contactIdForLog],
        organizationIds: orgId ? [orgId] : [],
        date: { start: new Date().toISOString().split("T")[0], end: null },
        notes: `batch campaign send to ${toEmail}`,
        loggedBy: senderName,
      });
    } catch {
      // non-critical
    }
  }

  return "sent";
}

// ── batch params / result ─────────────────────────────────

export interface BatchSendParams {
  subject: string;
  body: string;
  senderName?: string;
  orgs: Organization[];
  /** Campaign name — used for UTM attribution on outgoing links. */
  campaignName?: string;
  /** Campaign ID — stored on each EmailDraft for accurate analytics attribution. */
  campaignId?: string;
  /** Step ID — stored on each EmailDraft for per-step analytics and conditional branching. */
  stepId?: string;
  /** A/B test: variant B subject + body. First half gets A, second half gets B. */
  variantBSubject?: string;
  variantBBody?: string;
  /** Contact IDs explicitly excluded from the org fan-out. */
  removedContactIds?: string[];
  /** Directly-added contacts sent to regardless of org membership. */
  additionalContacts?: Contact[];
}

export interface BatchSendResult {
  sent: number;
  skipped: number;
  failed: number;
  /**
   * Recipients skipped specifically because a prior run of this step already sent
   * to them (draft exists with status "sent"). Counted inside `skipped` for
   * backwards compatibility, but surfaced separately so "already sent" is
   * distinguishable from "no email on file" or "opted out".
   */
  dedupSkipped?: number;
  /**
   * Recipients whose existing draft row was reused rather than creating a new one
   * (draft exists with status other than "sent" — e.g. "sending" / "failed" from
   * a stuck or crashed prior attempt). Counts toward `sent` if retry succeeds.
   */
  dedupReused?: number;
  variantA?: number;
  variantB?: number;
  /** First error message encountered, if any failures occurred. */
  firstError?: string;
}

// ── batch send ────────────────────────────────────────────

export async function batchSendEmails(params: BatchSendParams): Promise<BatchSendResult> {
  const { subject, body, senderName = "Garrett", orgs, campaignName, campaignId, stepId, variantBSubject, variantBBody, removedContactIds, additionalContacts } = params;
  const hasAB = !!(variantBSubject && variantBBody);
  const removedContactSet = new Set(removedContactIds ?? []);
  const result: BatchSendResult = { sent: 0, skipped: 0, failed: 0 };
  if (hasAB) {
    result.variantA = 0;
    result.variantB = 0;
  }

  // Filter out opted-out orgs
  const eligible = orgs.filter((o) => o.outreachStatus !== "Opted out");
  result.skipped = orgs.length - eligible.length;

  // ── Pre-fetch all contacts in parallel ───────────────────
  // Orgs with linked contact IDs need their contacts resolved so we can
  // fan out to personal emails. We do this upfront to avoid sequential
  // Notion API calls inside the hot send loop.
  const orgsWithContactIds = eligible.filter((o) => o.contactIds?.length);
  const contactMap = new Map<string, Contact[]>(); // orgId → contacts

  if (orgsWithContactIds.length > 0) {
    const fetches = orgsWithContactIds.flatMap((org) =>
      org.contactIds.map(async (cid) => {
        const c = await getContact(cid).catch(() => null);
        return { orgId: org.id, contact: c };
      }),
    );
    const settled = await Promise.allSettled(fetches);
    for (const r of settled) {
      if (r.status === "fulfilled" && r.value.contact) {
        const { orgId, contact } = r.value;
        if (!contactMap.has(orgId)) contactMap.set(orgId, []);
        contactMap.get(orgId)!.push(contact);
      }
    }
  }

  // ── Expand orgs → SendTargets ─────────────────────────────
  // Each org becomes either:
  //   - N targets (one per linked contact with a valid email, excluding removed), or
  //   - 1 target using org.email as fallback (when no eligible contacts remain)
  const targets: SendTarget[] = [];
  for (const org of eligible) {
    const contacts = contactMap.get(org.id);
    // Honour per-contact removals — skip contacts in the removed set
    const contactsWithEmail = contacts?.filter((c) => c.email && !removedContactSet.has(c.id)) ?? [];

    if (contactsWithEmail.length > 0) {
      for (const contact of contactsWithEmail) {
        targets.push({ org, contact });
      }
    } else if (org.email) {
      targets.push({ org });
    } else {
      // No contact emails and no org email — skip
      result.skipped++;
    }
  }

  // ── Append directly-added contacts ────────────────────────
  // These are contacts explicitly added to the campaign audience (not via an
  // org filter). They receive a personalised email regardless of org membership.
  if (additionalContacts?.length) {
    const existingEmails = new Set(targets.map((t) => t.contact?.email ?? t.org?.email));
    for (const contact of additionalContacts) {
      if (!contact.email) continue;
      if (removedContactSet.has(contact.id)) continue;
      // De-duplicate: skip if this email is already covered by an org fan-out
      if (existingEmails.has(contact.email)) continue;
      targets.push({ org: null, contact });
    }
  }

  // ── Pre-rehost images once ────────────────────────────────
  // Images in the template are the same for every recipient. Rehosting them
  // once before the send loop avoids N × (6 image fetches + R2 uploads) and
  // reduces per-email time from ~1.4s to ~0.4s.
  const [rehostedBodyTemplate, rehostedVariantBTemplate] = await Promise.all([
    rehostImages(body),
    variantBBody ? rehostImages(variantBBody) : Promise.resolve(undefined),
  ]);

  // ── Dedup map ─────────────────────────────────────────────
  // Query prior drafts for this step once, keyed by (orgId, contactId). Used in
  // the send loop below to (a) skip recipients whose previous send succeeded
  // and (b) reuse the draft row for recipients stuck in "sending" / "failed"
  // rather than creating duplicates. Without this, every re-run of a step
  // creates a fresh batch of drafts — which is the bug that made Payton's
  // audience=13 campaign accumulate 53 drafts.
  const existingByRecipient = new Map<string, { id: string; status: EmailDraftStatus }>();
  if (stepId) {
    try {
      const existing = await queryEmailDraftsByStep(stepId);
      for (const d of existing) {
        const key = recipientKey(d.organizationId, d.contactId);
        const current = existingByRecipient.get(key);
        // "sent" is sticky — once set, never unseat (prevents retrying a
        // successful send because a later duplicate draft was marked failed).
        if (current?.status === "sent") continue;
        existingByRecipient.set(key, { id: d.id, status: d.status });
      }
    } catch (err) {
      // Non-fatal — if the lookup fails, we fall through to the existing
      // "always create" behaviour. Better to risk a duplicate than to block a send.
      console.warn("[batch-send] dedup lookup failed, continuing without dedup:", err);
    }
  }

  // A/B split: sort by a stable key (prefer org ID, fall back to contact ID)
  const sorted = hasAB
    ? [...targets].sort((a, b) => {
        const keyA = a.org?.id ?? a.contact?.id ?? "";
        const keyB = b.org?.id ?? b.contact?.id ?? "";
        return keyA.localeCompare(keyB);
      })
    : targets;
  const midpoint = Math.ceil(sorted.length / 2);

  // Send sequentially, one email every SEND_DELAY_MS, to stay under Resend's
  // 5 req/sec rate limit. Contact fan-out means we can't pre-predict concurrency
  // per batch, so sequential + fixed pacing is the safest approach.
  for (let i = 0; i < sorted.length; i++) {
    const { org, contact } = sorted[i];
    const isVariantB = hasAB && i >= midpoint;
    const useSubject = isVariantB ? variantBSubject! : subject;
    const useBody = isVariantB ? variantBBody! : body;
    const usePreRehosted = isVariantB ? rehostedVariantBTemplate : rehostedBodyTemplate;
    const variant = hasAB ? (isVariantB ? "b" as const : "a" as const) : undefined;

    // Look up any existing draft for this recipient on this step
    const orgIdForKey = org?.id ?? contact?.organizationIds?.[0] ?? "";
    const prior = existingByRecipient.get(recipientKey(orgIdForKey, contact?.id ?? null));

    // Already sent — don't duplicate. Count under skipped for the caller.
    if (prior?.status === "sent") {
      result.skipped++;
      result.dedupSkipped = (result.dedupSkipped ?? 0) + 1;
      continue;
    }

    // Pace sends to ≤4/sec (only when we actually call Resend below — dedup
    // skips above don't need a delay)
    if (i > 0) await new Promise((r) => setTimeout(r, SEND_DELAY_MS));

    const reuseDraftId = prior ? prior.id : undefined;

    try {
      const value = await sendSingleEmail(org, useSubject, useBody, senderName, campaignName, variant, contact, campaignId, stepId, usePreRehosted, reuseDraftId);
      if (value === "sent") {
        result.sent++;
        if (reuseDraftId) result.dedupReused = (result.dedupReused ?? 0) + 1;
        if (hasAB) {
          if (isVariantB) result.variantB!++;
          else result.variantA!++;
        }
      } else {
        result.skipped++;
      }
    } catch (err) {
      result.failed++;
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[batch-send] failed:", msg);
      if (!result.firstError) result.firstError = msg;
    }
  }

  return result;
}

/** Stable key for the dedup map: "orgId:contactId" (either side may be empty). */
function recipientKey(orgId: string, contactId: string | null | undefined): string {
  return `${orgId}:${contactId ?? ""}`;
}

// ── multi-channel: social draft creation ─────────────────

export interface BatchSocialParams {
  body: string;
  platform: SocialPlatform;
  orgs: Organization[];
  senderName?: string;
}

export interface BatchSocialResult {
  created: number;
  skipped: number;
  failed: number;
}

/**
 * Create social drafts for all orgs in the audience.
 * Each org gets its own social draft with resolved template variables.
 * Drafts land in the social queue kanban as "draft" status.
 */
export async function batchCreateSocialDrafts(
  params: BatchSocialParams,
): Promise<BatchSocialResult> {
  const { body, platform, orgs, senderName = "Garrett" } = params;
  const result: BatchSocialResult = { created: 0, skipped: 0, failed: 0 };

  for (let i = 0; i < orgs.length; i += SOCIAL_BATCH_SIZE) {
    const batch = orgs.slice(i, i + SOCIAL_BATCH_SIZE);
    const settled = await Promise.allSettled(
      batch.map(async (org) => {
        const ctx: TemplateContext = {
          orgName: org.organization,
          firstName: org.organization?.split(" ")[0] || "",
          senderName,
          orgEmail: org.email,
          orgWebsite: org.website,
          bespokeEmailCopy: org.bespokeEmailCopy,
          outreachSuggestion: org.outreachSuggestion,
        };
        const resolvedBody = resolveTemplateVars(body, ctx);

        await createSocialDraft({
          content: resolvedBody,
          platform,
          status: "draft",
          organizationId: org.id,
        });
        return "created" as const;
      }),
    );

    for (const r of settled) {
      if (r.status === "fulfilled") {
        result.created++;
      } else {
        result.failed++;
        console.error("[batch-social] failed:", r.reason);
      }
    }
  }

  return result;
}
