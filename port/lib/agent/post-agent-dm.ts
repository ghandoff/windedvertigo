/**
 * Push DM helper — any cron job, webhook handler, or background task can
 * call this to deliver a Slack message AS the wv-claw bot.
 *
 * Two entry points:
 *   - postAgentDmByEmail(email, text): looks up Slack user via users.lookupByEmail,
 *     opens an IM, posts. Use this from server-side code where you have an email.
 *   - postAgentDmByUserId(slackUserId, text): if you already have the Slack id,
 *     skip the lookup.
 *
 * Fail-open: never throws, returns boolean (true = delivered, false = silently
 * dropped). Logs reasons via console.warn so the worker tail captures them.
 */

import { slackAgentApi } from "./slack-agent-api";

const userIdCache = new Map<string, string | null>();

async function lookupUserIdByEmail(email: string): Promise<string | null> {
  const cached = userIdCache.get(email);
  if (cached !== undefined) return cached;
  try {
    const res = await slackAgentApi({
      method: "users.lookupByEmail",
      body: { email },
    });
    const userId: string | undefined = res?.user?.id;
    if (!userId) {
      console.warn(`[post-agent-dm] no Slack user for ${email}`);
      userIdCache.set(email, null);
      return null;
    }
    userIdCache.set(email, userId);
    return userId;
  } catch (err) {
    console.warn(
      `[post-agent-dm] lookupByEmail threw for ${email}:`,
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}

export async function postAgentDmByUserId(
  slackUserId: string,
  text: string,
): Promise<boolean> {
  try {
    const openRes = await slackAgentApi({
      method: "conversations.open",
      body: { users: slackUserId },
    });
    const channelId: string | undefined = openRes?.channel?.id;
    if (!channelId) {
      console.warn(`[post-agent-dm] conversations.open returned no channel for ${slackUserId}`);
      return false;
    }
    const res = await slackAgentApi({
      method: "chat.postMessage",
      body: { channel: channelId, text },
    });
    return !!res?.ok;
  } catch (err) {
    console.warn(
      `[post-agent-dm] post to ${slackUserId} threw:`,
      err instanceof Error ? err.message : err,
    );
    return false;
  }
}

export async function postAgentDmByEmail(
  email: string,
  text: string,
): Promise<boolean> {
  const userId = await lookupUserIdByEmail(email.toLowerCase());
  if (!userId) return false;
  return postAgentDmByUserId(userId, text);
}
