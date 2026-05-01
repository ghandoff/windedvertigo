/**
 * Slack Web API helper for the port agent.
 *
 * Uses SLACK_AGENT_BOT_TOKEN (dedicated to the WV-Claw app) rather than
 * SLACK_BOT_TOKEN (used by existing cron / digest integrations), so the
 * two bots stay independent.
 */

interface SlackAgentApiOptions {
  method: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  body: Record<string, any>;
}

/**
 * Slack API body encoding:
 *   - users.info (and a few other older endpoints) do NOT accept JSON body
 *     for scalar params — they require form-encoded. See:
 *     https://api.slack.com/web#basics "Some endpoints require form-encoded"
 *   - If the body is scalar-only (strings, numbers, booleans), use form.
 *   - If any value is an object/array (e.g. chat.postMessage with blocks),
 *     JSON is required.
 */
function needsFormEncoding(body: Record<string, unknown>): boolean {
  return Object.values(body).every(
    (v) => v == null || typeof v === "string" || typeof v === "number" || typeof v === "boolean",
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function slackAgentApi({ method, body }: SlackAgentApiOptions): Promise<any> {
  const token = process.env.SLACK_AGENT_BOT_TOKEN;
  if (!token) {
    console.warn("[agent-slack] SLACK_AGENT_BOT_TOKEN not set — skipping");
    return null;
  }

  const useForm = needsFormEncoding(body);
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    "Content-Type": useForm
      ? "application/x-www-form-urlencoded"
      : "application/json; charset=utf-8",
  };
  const encodedBody = useForm
    ? new URLSearchParams(
        Object.fromEntries(
          Object.entries(body).filter(([, v]) => v != null).map(([k, v]) => [k, String(v)]),
        ),
      ).toString()
    : JSON.stringify(body);

  const res = await fetch(`https://slack.com/api/${method}`, {
    method: "POST",
    headers,
    body: encodedBody,
  });

  const data = await res.json();
  if (!data.ok) {
    console.warn(`[agent-slack] ${method} failed:`, data.error);
  }
  return data;
}
