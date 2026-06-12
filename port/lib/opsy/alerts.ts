/**
 * Opsy → Slack severity routing (docs/opsy/posture.md §1):
 *   critical → DM garrett AND post to #ops-alerts
 *   warning  → #ops-alerts only
 *   info     → nothing (weekly digest is phase 3)
 *
 * Every function is fail-open: alerting must never break a check run or a
 * cron retry. Voice per posture: lowercase, calm, past-tense for fixes.
 */

import { ensureChannel, postToChannel, sendDm, sendDmByEmail } from "@/lib/slack";

const CHANNEL = () => process.env.OPSY_ALERTS_CHANNEL || "#ops-alerts";
const OPS_LEAD_EMAIL = "garrett@windedvertigo.com";

/**
 * Post to the ops channel, self-healing on first use: if the post fails
 * (channel missing or bot not a member), create/join #ops-alerts + invite
 * garrett, then retry once. If the bot lacks scopes this degrades to a
 * console warning — never throws.
 */
async function postOps(text: string): Promise<void> {
  const channel = CHANNEL();
  if (await postToChannel(channel, text)) return;
  const id = await ensureChannel(channel, [OPS_LEAD_EMAIL]);
  if (id && (await postToChannel(id, text))) return;
  console.warn(`[opsy/alerts] could not post to ${channel} — create it and /invite the bot`);
}

export interface AlertableIncident {
  id: string;
  service: string;
  severity: "critical" | "warning" | "info";
  symptoms: string;
  cause?: string | null;
  remediation?: string | null;
  opened_at?: string;
}

function utcStamp(iso?: string): string {
  const d = iso ? new Date(iso) : new Date();
  const mins = Math.round((Date.now() - d.getTime()) / 60_000);
  const ago = mins <= 0 ? "just now" : mins === 1 ? "1 minute ago" : `${mins} minutes ago`;
  return `${d.toISOString().slice(11, 16)} UTC (${ago})`;
}

async function dmOpsLead(text: string): Promise<void> {
  try {
    const userId = process.env.GARRETT_SLACK_USER_ID;
    const ok = userId ? await sendDm(userId, text) : false;
    if (!ok) await sendDmByEmail(OPS_LEAD_EMAIL, text);
  } catch (err) {
    console.warn("[opsy/alerts] DM failed:", err);
  }
}

/** Post a plain Opsy update to #ops-alerts (auto-fix notes, recoveries). */
export async function postOpsNote(text: string): Promise<void> {
  try {
    await postOps(text);
  } catch (err) {
    console.warn("[opsy/alerts] channel post failed:", err);
  }
}

export async function notifyIncidentOpened(incident: AlertableIncident): Promise<void> {
  if (incident.severity === "info") return;

  const emoji = incident.severity === "critical" ? ":red_circle:" : ":large_yellow_circle:";
  const lines = [
    `${emoji} *${incident.severity}* — ${incident.service}`,
    "",
    `*service:* ${incident.service}`,
    `*started:* ${utcStamp(incident.opened_at)}`,
    `*symptoms:* ${incident.symptoms}`,
  ];
  if (incident.cause) lines.push(`*likely cause:* ${incident.cause}`);
  lines.push("", "_I'll update when it's resolved._");
  const text = lines.join("\n");

  try {
    await postOps(text);
    if (incident.severity === "critical") await dmOpsLead(text);
  } catch (err) {
    console.warn("[opsy/alerts] notifyIncidentOpened failed:", err);
  }
}

export async function notifyIncidentResolved(
  incident: AlertableIncident,
  resolution: string,
): Promise<void> {
  if (incident.severity === "info") return;
  await postOpsNote(
    `:large_green_circle: *resolved* — ${incident.service}\n${resolution}`,
  );
}
