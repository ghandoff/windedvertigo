/**
 * Slack integration — webhook channel posts + bot DMs.
 *
 * Two modes:
 *   1. Webhook (SLACK_WEBHOOK_URL) — posts to a channel. Used by existing crons.
 *   2. Bot token (SLACK_BOT_TOKEN) — sends DMs, supports Block Kit.
 *      Required for personalized morning digests and approval requests.
 *
 * If a token/url is missing, the function logs a warning and no-ops —
 * safe to call in crons even before env vars are configured.
 */

// ── Webhook (existing) ─────────────────────────────────

export async function postToSlack(text: string): Promise<void> {
  const url = process.env.SLACK_WEBHOOK_URL;
  if (!url) {
    console.warn("[slack] SLACK_WEBHOOK_URL not set — skipping");
    return;
  }

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    if (!res.ok) {
      console.warn(`[slack] webhook returned ${res.status}`);
    }
  } catch (err) {
    console.warn("[slack] failed to post:", err);
  }
}

// ── Bot API ────────────────────────────────────────────

interface SlackApiOptions {
  method: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  body: Record<string, any>;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function slackApi({ method, body }: SlackApiOptions): Promise<any> {
  const token = process.env.SLACK_BOT_TOKEN;
  if (!token) {
    console.warn("[slack] SLACK_BOT_TOKEN not set — skipping");
    return null;
  }

  const res = await fetch(`https://slack.com/api/${method}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json; charset=utf-8",
    },
    body: JSON.stringify(body),
  });

  const data = await res.json();
  if (!data.ok) {
    console.warn(`[slack] ${method} failed:`, data.error);
  }
  return data;
}

/**
 * Look up a Slack user ID by their email address.
 * Returns null if not found or bot token is missing.
 */
export async function getSlackUserByEmail(email: string): Promise<string | null> {
  const data = await slackApi({
    method: "users.lookupByEmail",
    body: { email },
  });
  return data?.user?.id ?? null;
}

/**
 * Open (or reuse) a DM channel with a user and return the channel ID.
 */
export async function openDm(slackUserId: string): Promise<string | null> {
  const data = await slackApi({
    method: "conversations.open",
    body: { users: slackUserId },
  });
  return data?.channel?.id ?? null;
}

/**
 * Send a DM to a user by their Slack user ID.
 * Supports both plain text and Block Kit blocks.
 */
export async function sendDm(
  slackUserId: string,
  text: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  blocks?: any[],
): Promise<boolean> {
  const channelId = await openDm(slackUserId);
  if (!channelId) return false;

  const data = await slackApi({
    method: "chat.postMessage",
    body: {
      channel: channelId,
      text, // fallback for notifications
      ...(blocks ? { blocks } : {}),
    },
  });

  return data?.ok === true;
}

/**
 * Send a DM to a user by email address.
 * Convenience wrapper: email → Slack user ID → DM.
 * Returns false if user not found or message fails.
 */
export async function sendDmByEmail(
  email: string,
  text: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  blocks?: any[],
): Promise<boolean> {
  const userId = await getSlackUserByEmail(email);
  if (!userId) {
    console.warn(`[slack] no Slack user found for ${email}`);
    return false;
  }
  return sendDm(userId, text, blocks);
}

/**
 * Post a message to a channel by name (e.g. "#funding-opportunities") or ID.
 * The bot must be invited to the channel. Fail-open if SLACK_BOT_TOKEN is unset
 * or the API call fails — returns false without throwing.
 *
 * Prefer this over postToSlack() when you need to target a specific channel
 * rather than the single webhook-configured one.
 */
export async function postToChannel(
  channel: string,
  text: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  blocks?: any[],
): Promise<boolean> {
  const data = await slackApi({
    method: "chat.postMessage",
    body: {
      channel,
      text, // required fallback for notifications / screen readers
      ...(blocks ? { blocks } : {}),
    },
  });
  return data?.ok === true;
}

/**
 * Resolve an array of emails to an `<@U123> <@U456>` mention string. Emails
 * that can't be resolved are silently dropped (don't want to send a message
 * with a dangling plaintext email in it). Empty array → empty string.
 *
 * Safe to call without a bot token — each lookup fails quietly and the result
 * is just an empty mention string.
 */
export async function buildMentionsFromEmails(emails: string[]): Promise<string> {
  const ids = await Promise.all(emails.map((e) => getSlackUserByEmail(e).catch(() => null)));
  return ids.filter((id): id is string => !!id).map((id) => `<@${id}>`).join(" ");
}
