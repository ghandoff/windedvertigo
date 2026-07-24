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
  // SLACK_AGENT_BOT_TOKEN (wv-claw) preferred: confirmed live as of 2026-07-20.
  // SLACK_BOT_TOKEN (the older, separately-maintained "digest bot") started
  // returning account_inactive on every call the same night — dead, not just
  // uninvited to a channel. Falls back to it only so this doesn't go fully
  // silent if SLACK_AGENT_BOT_TOKEN is ever unset in some other environment.
  // If the digest-bot identity needs restoring later (separate Slack posting
  // name/avatar for whirlpool-checkin/weekly-digest etc.), that's a follow-up
  // — get SLACK_BOT_TOKEN a live credential again and flip the preference.
  const token = process.env.SLACK_AGENT_BOT_TOKEN ?? process.env.SLACK_BOT_TOKEN;
  if (!token) {
    console.warn("[slack] SLACK_AGENT_BOT_TOKEN / SLACK_BOT_TOKEN not set — skipping");
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
 * Resolve a Slack user ID to their email — the reverse of getSlackUserByEmail.
 * Requires the users:read.email bot scope; returns null (not throw) if the
 * scope is missing or the user has no email on file, same fail-open posture
 * as the rest of this file.
 */
export async function getSlackUserEmail(userId: string): Promise<string | null> {
  const data = await slackApi({ method: "users.info", body: { user: userId } });
  return data?.user?.profile?.email ?? null;
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
  return (await postToChannelDetailed(channel, text, blocks)).ok;
}

export interface PostToChannelDetail {
  ok: boolean;
  /** message timestamp — the id you thread a resolve-note reply against (postThreadReply). */
  ts?: string;
}

/**
 * Same as postToChannel(), but also returns the posted message's `ts` so a
 * caller can later thread a reply against it (see postThreadReply()). Kept
 * separate from postToChannel() so the many existing boolean-returning call
 * sites don't need to change.
 */
export async function postToChannelDetailed(
  channel: string,
  text: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  blocks?: any[],
): Promise<PostToChannelDetail> {
  const data = await slackApi({
    method: "chat.postMessage",
    body: {
      channel,
      text, // required fallback for notifications / screen readers
      ...(blocks ? { blocks } : {}),
    },
  });
  return { ok: data?.ok === true, ts: data?.ts };
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  blocks?: any[],
): Promise<boolean> {
  return (await postToChannelResilientDetailed(channel, text, inviteEmails, blocks)).posted;
}

export interface PostToChannelResilientDetail {
  posted: boolean;
  ts?: string;
  /** the channel the message actually landed in — may differ from the input if ensureChannel() resolved it (e.g. name → id). */
  resolvedChannel?: string;
}

/**
 * Same self-healing behaviour as postToChannelResilient(), but also returns
 * the message `ts` + the channel it actually landed in — needed by callers
 * (lib/escalation.ts's level-3 escalate()) that later thread a resolve-note
 * reply via postThreadReply().
 */
export async function postToChannelResilientDetailed(
  channel: string,
  text: string,
  inviteEmails: string[] = [],
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  blocks?: any[],
): Promise<PostToChannelResilientDetail> {
  const first = await postToChannelDetailed(channel, text, blocks);
  if (first.ok) return { posted: true, ts: first.ts, resolvedChannel: channel };
  const id = await ensureChannel(channel, inviteEmails);
  if (id) {
    const retry = await postToChannelDetailed(id, text, blocks);
    if (retry.ok) return { posted: true, ts: retry.ts, resolvedChannel: id };
  }
  console.warn(`[slack] could not post to ${channel} — create it and /invite the bot`);
  return { posted: false };
}

/**
 * Post a threaded reply to an existing message — used for resolve-notes
 * (Opsy's `:large_green_circle: *resolved* — …` pattern, generalized in
 * lib/escalation.ts's resolveEscalation()). `replyBroadcast` also surfaces
 * the reply in the channel's main timeline, not just inside the thread, so a
 * closed alert is visible without opening the thread. Fail-open: returns
 * false rather than throwing.
 */
export async function postThreadReply(
  channel: string,
  threadTs: string,
  text: string,
  replyBroadcast = true,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  blocks?: any[],
): Promise<boolean> {
  return (await postThreadReplyDetailed(channel, threadTs, text, replyBroadcast, blocks)).ok;
}

/**
 * Same as postThreadReply(), but returns the posted reply's `ts` — needed by
 * callers that persist the reply for audit/idempotency (soundings stores the
 * kickoff + digest reply ts). Kept separate so boolean call sites don't change.
 */
export async function postThreadReplyDetailed(
  channel: string,
  threadTs: string,
  text: string,
  replyBroadcast = true,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  blocks?: any[],
): Promise<PostToChannelDetail> {
  const data = await slackApi({
    method: "chat.postMessage",
    body: {
      channel,
      thread_ts: threadTs,
      text,
      reply_broadcast: replyBroadcast,
      ...(blocks ? { blocks } : {}),
    },
  });
  return { ok: data?.ok === true, ts: data?.ts };
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

export interface SlackThreadMessage extends SlackMessage {
  thread_ts?: string;
  subtype?: string;
  bot_id?: string;
  files?: Array<{
    id: string;
    mimetype?: string;
    subtype?: string;
    url_private_download?: string;
    name?: string;
  }>;
}

/**
 * Read a thread's replies (conversations.replies), excluding the root
 * message. Unlike readChannelHistory() this KEEPS subtype/file messages —
 * slack voice notes arrive as `file_share` messages and are exactly what the
 * soundings capture sweep is after; classification happens in the caller.
 * `oldest` (exclusive) lets a sweep resume from its last captured reply.
 * Fail-open: returns [] with a console.warn rather than throwing.
 */
export async function getThreadReplies(
  channel: string,
  threadTs: string,
  oldest?: string,
): Promise<SlackThreadMessage[]> {
  const channelId = await getChannelIdByName(channel);
  if (!channelId) {
    console.warn(`[slack] getThreadReplies: could not resolve channel ${channel}`);
    return [];
  }
  const messages: SlackThreadMessage[] = [];
  let cursor: string | undefined;
  do {
    const data = await slackApi({
      method: "conversations.replies",
      body: { channel: channelId, ts: threadTs, oldest, limit: 200, cursor },
    });
    if (!data?.ok) {
      if (data?.error) console.warn(`[slack] conversations.replies failed for ${channel}:`, data.error);
      break;
    }
    for (const m of data.messages ?? []) {
      if (m.ts === threadTs) continue; // the root message is not a reply
      if (oldest && Number(m.ts) <= Number(oldest)) continue; // exclusive cursor
      messages.push({
        ts: m.ts,
        user: m.user,
        text: m.text ?? "",
        thread_ts: m.thread_ts,
        subtype: m.subtype,
        bot_id: m.bot_id,
        files: m.files,
      });
    }
    cursor = data.response_metadata?.next_cursor || undefined;
  } while (cursor);
  return messages;
}

/**
 * Download a Slack-hosted file (url_private_download) using the bot token —
 * Slack files require `Authorization: Bearer <token>` + the files:read scope.
 * When auth fails Slack serves an HTML login page with HTTP 200, so an HTML
 * body is treated as failure. Fail-open: returns null rather than throwing.
 */
export async function downloadSlackFile(
  urlPrivateDownload: string,
): Promise<{ buffer: Buffer; contentType: string } | null> {
  const token = process.env.SLACK_AGENT_BOT_TOKEN ?? process.env.SLACK_BOT_TOKEN;
  if (!token) {
    console.warn("[slack] downloadSlackFile: no bot token set — skipping");
    return null;
  }
  try {
    const res = await fetch(urlPrivateDownload, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      console.warn(`[slack] downloadSlackFile: HTTP ${res.status}`);
      return null;
    }
    const contentType = res.headers.get("content-type") ?? "application/octet-stream";
    if (contentType.includes("text/html")) {
      console.warn("[slack] downloadSlackFile: got HTML (auth failure / missing files:read scope)");
      return null;
    }
    const buffer = Buffer.from(await res.arrayBuffer());
    return { buffer, contentType };
  } catch (err) {
    console.warn("[slack] downloadSlackFile failed:", err);
    return null;
  }
}

/**
 * Add an emoji reaction to a message (reactions.add) — the soundings capture
 * ack (✅ on a processed voice note). Requires reactions:write; fail-open, and
 * `already_reacted` counts as success (idempotent re-processing).
 */
export async function addReaction(channel: string, ts: string, name: string): Promise<boolean> {
  const data = await slackApi({
    method: "reactions.add",
    body: { channel, timestamp: ts, name },
  });
  return data?.ok === true || data?.error === "already_reacted";
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
