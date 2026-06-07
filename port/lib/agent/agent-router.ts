/**
 * Agent router — detect which agent a Slack/web message is addressed to.
 *
 * Detection is case-insensitive and name-first. If no agent name is found
 * the generic port agent ('port') is the fallback.
 */

export type AgentId = "mo" | "pam" | "carl" | "port";

/**
 * Return the AgentId for an inbound message.
 * Called once per Slack event before the agentic loop starts.
 */
export function detectAgent(text: string): AgentId {
  const lower = text.toLowerCase();

  // Mo / CMO — match "mo", "moe", "cmo" as whole words
  if (/\b(mo|moe|cmo)\b/.test(lower)) return "mo";

  // PaM — match "pam", "pm", "project manager"
  if (/\b(pam|pm|project\s+manager)\b/.test(lower)) return "pam";

  // cARL — match "carl" or the word "research" used as an address
  if (/\b(carl|research)\b/.test(lower)) return "carl";

  return "port";
}

export const AGENT_API_PATHS: Record<Exclude<AgentId, "port">, string> = {
  mo:   "cmo",
  pam:  "pam",
  carl: "carl",
};
