/**
 * Notification email templates — activity summaries and weekly digests.
 *
 * Uses the same Resend setup and inline HTML pattern as email.ts.
 */

import { Resend } from "resend";
import type { ActivityEntry } from "./db/queries";

let _resend: Resend | null = null;

function getResend(): Resend {
  if (!_resend) {
    const key = process.env.RESEND_API_KEY;
    if (!key) throw new Error("RESEND_API_KEY not set");
    _resend = new Resend(key);
  }
  return _resend;
}

const DOMAIN = process.env.RESEND_DOMAIN ?? "windedvertigo.com";
const REPLY_TO = process.env.RESEND_REPLY_TO ?? `garrett@${DOMAIN}`;
const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ?? "https://wv-ancestry.vercel.app";

// ─── helpers ─────────────────────────────────────────────────

function describeActivity(entry: ActivityEntry): string {
  const name = entry.target_name ?? "an entry";
  const map: Record<string, string> = {
    person_added: `added ${name} to the tree`,
    person_updated: `updated ${name}`,
    person_deleted: `removed ${name}`,
    relationship_added: `added a relationship for ${name}`,
    merge_persons: `merged duplicate entries`,
    comment_added: `left a comment on ${name}`,
    task_created: `added a research task for ${name}`,
    hint_accepted: `accepted a hint for ${name}`,
    hint_rejected: `rejected a hint for ${name}`,
    media_added: `added a photo for ${name}`,
    media_deleted: `removed a photo from ${name}`,
  };
  return map[entry.action] ?? `${entry.action.replace(/_/g, " ")} — ${name}`;
}

function actorName(email: string): string {
  return email.split("@")[0];
}

type GroupedActivity = {
  actor: string;
  actorEmail: string;
  items: string[];
};

function groupByActor(activities: ActivityEntry[]): GroupedActivity[] {
  const map = new Map<string, GroupedActivity>();
  for (const a of activities) {
    let group = map.get(a.actor_email);
    if (!group) {
      group = {
        actor: actorName(a.actor_email),
        actorEmail: a.actor_email,
        items: [],
      };
      map.set(a.actor_email, group);
    }
    group.items.push(describeActivity(a));
  }
  return [...map.values()];
}

function formatDate(d: Date): string {
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

// ─── email shell ─────────────────────────────────────────────

function emailShell(bodyHtml: string, footerHtml: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="480" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e4e4e7;">
          <!-- header -->
          <tr>
            <td style="padding:32px 32px 24px;border-bottom:1px solid #e4e4e7;">
              <div style="font-size:14px;font-weight:600;color:#18181b;letter-spacing:-0.01em;">w.v ancestry</div>
            </td>
          </tr>
          <!-- body -->
          <tr>
            <td style="padding:32px;">
              ${bodyHtml}
            </td>
          </tr>
          <!-- footer -->
          <tr>
            <td style="padding:20px 32px;border-top:1px solid #e4e4e7;">
              ${footerHtml}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`.trim();
}

// ─── immediate activity summary ──────────────────────────────

export async function sendActivitySummaryEmail({
  to,
  treeName,
  treeId,
  activities,
}: {
  to: string;
  treeName: string;
  treeId: string;
  activities: ActivityEntry[];
}) {
  const groups = groupByActor(activities);
  const treeUrl = `${APP_URL}?tree=${treeId}`;
  const prefsUrl = `${APP_URL}/settings?tree=${treeId}#notifications`;

  // subject line
  const actors = groups.map((g) => g.actor);
  const subjectActor =
    actors.length === 1 ? actors[0] : `${actors.length} members`;
  const subject = `${treeName}: ${activities.length} update${activities.length === 1 ? "" : "s"} from ${subjectActor}`;

  // body html
  const activityHtml = groups
    .map((g) => {
      const items = g.items
        .map(
          (item) =>
            `<li style="margin:0 0 4px;font-size:13px;line-height:1.5;color:#3f3f46;">${item}</li>`
        )
        .join("");
      return `
        <p style="margin:0 0 8px;font-size:13px;font-weight:600;color:#18181b;">${g.actor}</p>
        <ul style="margin:0 0 16px;padding-left:20px;">${items}</ul>`;
    })
    .join("");

  const bodyHtml = `
    <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#3f3f46;">
      new activity on <strong>${treeName}</strong>:
    </p>
    ${activityHtml}
    <a href="${treeUrl}" style="display:inline-block;background:#18181b;color:#ffffff;font-size:13px;font-weight:500;text-decoration:none;padding:10px 20px;border-radius:6px;">
      open tree
    </a>`;

  const footerHtml = `
    <p style="margin:0;font-size:11px;color:#a1a1aa;">
      you're receiving this because you collaborate on this family tree.
      <a href="${prefsUrl}" style="color:#71717a;">manage notifications</a>
    </p>`;

  // plain text
  const textLines = [
    `new activity on "${treeName}":`,
    "",
    ...groups.flatMap((g) => [
      `${g.actor}:`,
      ...g.items.map((i) => `  - ${i}`),
      "",
    ]),
    `open the tree: ${treeUrl}`,
    "",
    "---",
    `manage notifications: ${prefsUrl}`,
  ];

  return getResend().emails.send({
    from: `w.v ancestry <ancestry@${DOMAIN}>`,
    to,
    subject,
    html: emailShell(bodyHtml, footerHtml),
    text: textLines.join("\n"),
    replyTo: REPLY_TO,
    tags: [
      { name: "app", value: "ancestry" },
      { name: "type", value: "activity-summary" },
    ],
  });
}

// ─── weekly digest ───────────────────────────────────────────

export async function sendWeeklyDigestEmail({
  to,
  treeName,
  treeId,
  activities,
  weekStart,
}: {
  to: string;
  treeName: string;
  treeId: string;
  activities: ActivityEntry[];
  weekStart: Date;
}) {
  const treeUrl = `${APP_URL}?tree=${treeId}`;
  const prefsUrl = `${APP_URL}/settings?tree=${treeId}#notifications`;
  const weekLabel = formatDate(weekStart);

  const subject = `your ${treeName} family tree — week of ${weekLabel}`;

  const groups = groupByActor(activities);

  // summary stats
  const totalEdits = activities.length;
  const uniqueActors = groups.length;

  const activityHtml = groups
    .map((g) => {
      const items = g.items
        .slice(0, 10) // cap at 10 per actor for readability
        .map(
          (item) =>
            `<li style="margin:0 0 4px;font-size:13px;line-height:1.5;color:#3f3f46;">${item}</li>`
        )
        .join("");
      const moreCount = g.items.length - 10;
      const moreHtml =
        moreCount > 0
          ? `<li style="margin:0;font-size:12px;color:#a1a1aa;">+ ${moreCount} more</li>`
          : "";
      return `
        <p style="margin:0 0 8px;font-size:13px;font-weight:600;color:#18181b;">${g.actor}</p>
        <ul style="margin:0 0 16px;padding-left:20px;">${items}${moreHtml}</ul>`;
    })
    .join("");

  const bodyHtml = `
    <p style="margin:0 0 8px;font-size:14px;line-height:1.6;color:#3f3f46;">
      weekly summary for <strong>${treeName}</strong>
    </p>
    <p style="margin:0 0 20px;font-size:13px;color:#71717a;">
      ${totalEdits} update${totalEdits === 1 ? "" : "s"} from ${uniqueActors} contributor${uniqueActors === 1 ? "" : "s"} this week
    </p>
    ${activityHtml}
    <a href="${treeUrl}" style="display:inline-block;background:#18181b;color:#ffffff;font-size:13px;font-weight:500;text-decoration:none;padding:10px 20px;border-radius:6px;">
      open tree
    </a>`;

  const footerHtml = `
    <p style="margin:0;font-size:11px;color:#a1a1aa;">
      weekly digest for your family tree on
      <a href="${APP_URL}" style="color:#71717a;">w.v ancestry</a>.
      <a href="${prefsUrl}" style="color:#71717a;">manage notifications</a>
    </p>`;

  const textLines = [
    `weekly summary for "${treeName}" — week of ${weekLabel}`,
    `${totalEdits} update(s) from ${uniqueActors} contributor(s)`,
    "",
    ...groups.flatMap((g) => [
      `${g.actor}:`,
      ...g.items.slice(0, 10).map((i) => `  - ${i}`),
      ...(g.items.length > 10
        ? [`  + ${g.items.length - 10} more`]
        : []),
      "",
    ]),
    `open the tree: ${treeUrl}`,
    "",
    "---",
    `manage notifications: ${prefsUrl}`,
  ];

  return getResend().emails.send({
    from: `w.v ancestry <ancestry@${DOMAIN}>`,
    to,
    subject,
    html: emailShell(bodyHtml, footerHtml),
    text: textLines.join("\n"),
    replyTo: REPLY_TO,
    tags: [
      { name: "app", value: "ancestry" },
      { name: "type", value: "weekly-digest" },
    ],
  });
}
