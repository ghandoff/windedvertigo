/**
 * Maps an inbound Slack user_id to a port Auth.js user (by email).
 *
 * Slack → email via `users.info`. Email is the stable identifier used by
 * Auth.js session (see `@windedvertigo/auth` — Google OAuth, domain
 * allowlist, email-keyed).
 *
 * No match = return null. Caller should reject the agent turn and DM a
 * friendly "no port account" response — never partially execute with a
 * fallback scope.
 */

import type { AgentUser } from "./types";
import { slackAgentApi } from "./slack-agent-api";

/** Per-Lambda-instance cache. Small, best-effort — fine if it's cold on cold start. */
const userCache = new Map<string, AgentUser>();

export async function resolveUser(
  slackUserId: string,
): Promise<AgentUser | null> {
  const cached = userCache.get(slackUserId);
  if (cached) return cached;

  const res = await slackAgentApi({
    method: "users.info",
    body: { user: slackUserId },
  });

  const profile = res?.user?.profile;
  const email: string | undefined = profile?.email;
  if (!email) {
    console.warn(
      `[agent] users.info returned no email for ${slackUserId} (user may lack users:read.email scope or be a bot)`,
    );
    return null;
  }

  const displayName: string =
    profile.display_name_normalized ||
    profile.real_name_normalized ||
    profile.real_name ||
    email;

  const user: AgentUser = {
    email: email.toLowerCase(),
    slackUserId,
    displayName,
  };
  userCache.set(slackUserId, user);
  return user;
}

/** For tests — don't use in production paths. */
export function __clearUserCacheForTest(): void {
  userCache.clear();
}
