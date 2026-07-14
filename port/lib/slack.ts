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

  const data = await res.json() as { ok: boolean; error?: string };
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

/** Resolve a Slack user ID to a display name (falls back to real name, then the ID itself). */
export async function getSlackUserName(userId: string): Promise<string> {
  const data = await slackApi({ method: "users.info", body: { user: userId } });
  return data?.user?.profile?.display_name || data?.user?.real_name || userId;
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
 * Post to a channel, self-healing on first use — mirrors lib/opsy/alerts.ts's
 * postOps(): try a direct post, and if that fails (channel missing or bot not
 * a member) create/join the channel + invite the given emails, then retry
 * once. Returns whether the message actually landed, and always warns on
 * final failure rather than swallowing it — callers should surface this
 * (log it, reflect it in a response body) instead of a bare `.catch(() => {})`,
 * which hides every Slack failure with no trace.
 */
export async function postToChannelResilient(
  channel: string,
  text: string,
  inviteEmails: string[] = [],
): Promise<boolean> {
  if (await postToChannel(channel, text)) return true;
  const id = await ensureChannel(channel, inviteEmails);
  if (id && (await postToChannel(id, text))) return true;
  console.warn(`[slack] could not post to ${channel} — create it and /invite the bot`);
  return false;
}

/**
 * Ensure a public channel exists and the bot is a member; invite the given
 * users. Returns the channel ID, or null if the bot lacks the scopes
 * (channels:manage / channels:join) — callers should fall back gracefully.
 *
 * Flow: conversations.create → on name_taken, find via conversations.list and
 * conversations.join → conversations.invite for each resolvable email.
 */
export async function ensureChannel(
  name: string,
  inviteEmails: string[] = [],
): Promise<string | null> {
  const plain = name.replace(/^#/, "");
  let channelId: string | null = null;

  if (/^[CG][A-Z0-9]{8,}$/.test(plain)) {
    // Already a channel ID (e.g. OPSY_ALERTS_CHANNEL=C…) — just try to join it.
    channelId = plain;
  } else {
    const created = await slackApi({ method: "conversations.create", body: { name: plain } });
    if (created?.ok) {
      // creator is automatically a member — no join needed
      const id = created.channel?.id ?? null;
      if (id) {
        for (const email of inviteEmails) {
          const userId = await getSlackUserByEmail(email);
          if (userId) await slackApi({ method: "conversations.invite", body: { channel: id, users: userId } });
        }
      }
      return id;
    }
    // create failed (name_taken, missing_scope, …) — the channel may still
    // exist (e.g. a human created it). Find it by name and fall through to
    // the join attempt: channels:join is commonly granted even when
    // channels:manage isn't.
    const list = await slackApi({
      method: "conversations.list",
      body: { types: "public_channel", limit: 1000, exclude_archived: true },
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    channelId = list?.channels?.find((c: any) => c.name === plain)?.id ?? null;
  }
  if (!channelId) return null;

  const joined = await slackApi({ method: "conversations.join", body: { channel: channelId } });
  if (!joined?.ok) return null;

  for (const email of inviteEmails) {
    const userId = await getSlackUserByEmail(email);
    if (userId) {
      await slackApi({ method: "conversations.invite", body: { channel: channelId, users: userId } });
    }
  }
  return channelId;
}

/**
 * Resolve a #channel-name to its Slack channel ID via conversations.list.
 * Returns null if not found or the bot lacks channels:read.
 */
export async function getChannelIdByName(name: string): Promise<string | null> {
  const plain = name.replace(/^#/, "");
  if (/^[CG][A-Z0-9]{8,}$/.test(plain)) return plain; // already an ID
  const list = await slackApi({
    method: "conversations.list",
    body: { types: "public_channel,private_channel", limit: 1000, exclude_archived: true },
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return list?.channels?.find((c: any) => c.name === plain)?.id ?? null;
}

export interface SlackMessage {
  ts: string;
  user?: string;
  text: string;
}

/**
 * Read a channel's message history since a given Slack timestamp (exclusive).
 * Requires the channels:history (or groups:history for private channels)
 * bot scope — returns an empty array (with a console.warn) if the scope is
 * missing or the channel can't be resolved, rather than throwing, so a sweep
 * cron degrades to "found nothing new" instead of crashing.
 */
export async function readChannelHistory(channel: string, oldest?: string): Promise<SlackMessage[]> {
  const channelId = await getChannelIdByName(channel);
  if (!channelId) {
    console.warn(`[slack] readChannelHistory: could not resolve channel ${channel}`);
    return [];
  }
  const messages: SlackMessage[] = [];
  let cursor: string | undefined;
  do {
    const data = await slackApi({
      method: "conversations.history",
      body: { channel: channelId, oldest, limit: 200, cursor },
    });
    if (!data?.ok) {
      if (data?.error) console.warn(`[slack] conversations.history failed for ${channel}:`, data.error);
      break;
    }
    for (const m of data.messages ?? []) {
      // Skip bot/system messages (joins, other agents' own posts) — the sweep
      // only wants human commitment talk.
      if (m.bot_id || m.subtype) continue;
      messages.push({ ts: m.ts, user: m.user, text: m.text ?? "" });
    }
    cursor = data.response_metadata?.next_cursor || undefined;
  } while (cursor);
  return messages;
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
