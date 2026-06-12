/**
 * Opsy email triage — classify an infrastructure notification email by
 * service + severity (Haiku; same pattern as conference-triage).
 */

import { callClaude, parseJsonResponse } from "@/lib/ai/client";

export interface OpsyEmailTriageInput {
  subject: string;
  from: string;
  body: string;
  receivedAt: string;
}

export interface OpsyEmailTriageResult {
  /** false for marketing, newsletters, receipts, product announcements */
  is_infra_alert: boolean;
  service:
    | "supabase"
    | "cloudflare"
    | "vercel"
    | "github"
    | "google-cloud"
    | "stripe"
    | "resend"
    | "neon"
    | "other";
  severity: "critical" | "warning" | "info";
  /** true when a human or agent should act (failure, quota, security, billing anomaly) */
  action_required: boolean;
  /** 1-2 sentence plain-language summary */
  summary: string;
}

const SYSTEM = `you are opsy, winded.vertigo's infrastructure monitoring agent. you classify automated emails from cloud vendors (supabase, cloudflare, vercel, github, google cloud, stripe, resend, neon).

classify ONE email. severity:
- critical: service down, data at risk, security vulnerability, certificate expiring within 48h, payment/billing failure, account suspension
- warning: degraded performance, approaching quotas or rate limits, failed deployments or CI, upcoming deprecations with deadlines, unusual spending
- info: routine summaries, maintenance windows, product news, receipts for expected charges

marketing emails, newsletters, feature announcements, and onboarding tips are NOT infra alerts (is_infra_alert=false, severity info, action_required false).

return ONLY json, no prose:
{
  "is_infra_alert": true,
  "service": "supabase" | "cloudflare" | "vercel" | "github" | "google-cloud" | "stripe" | "resend" | "neon" | "other",
  "severity": "critical" | "warning" | "info",
  "action_required": true,
  "summary": "1-2 sentences, lowercase, plain language"
}`;

export async function triageOpsyEmail(input: OpsyEmailTriageInput): Promise<OpsyEmailTriageResult> {
  const result = await callClaude({
    feature: "opsy-email-triage",
    system: SYSTEM,
    userMessage: `subject: ${input.subject}\nfrom: ${input.from}\nreceived: ${input.receivedAt}\n\n${input.body.slice(0, 6000)}`,
    userId: "automation",
    maxTokens: 300,
    temperature: 0.1,
  });
  return parseJsonResponse<OpsyEmailTriageResult>(result.text);
}
