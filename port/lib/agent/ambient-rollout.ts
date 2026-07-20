/**
 * Staged rollout gate for the ambient-agent spine
 * (docs/prompts/executive-agents-phase1-build.md §3: "sandbox → #studio-comms
 * only → full watch-list"). Controls which Slack channels the events route
 * actually ingests into event_log, independent of code deploys — Garrett
 * flips AMBIENT_ROLLOUT_STAGE once sandbox transcripts are reviewed, no
 * redeploy needed for the promotion itself (env var change only).
 *
 * Defaults to "sandbox" so a missing/misconfigured env var fails closed —
 * new code never starts watching production channels by accident.
 */

import { getChannelIdByName } from "@/lib/slack";

export type AmbientRolloutStage = "sandbox" | "studio-comms" | "full";

const STAGE_CHANNELS: Record<AmbientRolloutStage, string[]> = {
  sandbox: ["#agent-sandbox"],
  "studio-comms": ["#agent-sandbox", "#studio-comms"],
  full: ["#agent-sandbox", "#studio-comms", "#whirlpool"],
};

export function ambientRolloutStage(): AmbientRolloutStage {
  const raw = process.env.AMBIENT_ROLLOUT_STAGE;
  if (raw === "studio-comms" || raw === "full") return raw;
  return "sandbox";
}

/** Channels the ambient events route should write to event_log at the current stage. */
export function ambientWatchedChannels(): string[] {
  return STAGE_CHANNELS[ambientRolloutStage()];
}

/**
 * Where standalone ambient-spine crons (mo-friday-scorecard,
 * mo-content-runway-check, pam-monday-digest, pam-absence-horizon) should
 * post. These aren't gated by ambientWatchedChannels() (they don't read
 * Slack, they write to it proactively) — this is the parallel guard that
 * keeps THEM out of real channels until Garrett has reviewed sandbox
 * transcripts, per spec §3 ("nothing posts to real channels until Garrett
 * has approved sandbox transcripts").
 */
export function ambientNotifyChannel(): string {
  return ambientRolloutStage() === "sandbox" ? "#agent-sandbox" : "#studio-comms";
}

/**
 * Gate for crons that DM real individual humans directly (Monday digest,
 * owner-confirmation sweep) — ambientWatchedChannels()/ambientNotifyChannel()
 * only redirect CHANNEL posts to #agent-sandbox; a per-person DM has no
 * channel to redirect through. During "sandbox" stage these crons must
 * skip real DMs entirely (and post what they WOULD have sent to
 * ambientNotifyChannel() instead) — otherwise sandbox-stage testing would
 * still page real teammates, defeating the whole point of the stage gate
 * (spec §3: "nothing posts to real channels until Garrett has approved
 * sandbox transcripts" — a DM is the same kind of real-world action as a
 * channel post here).
 */
export function ambientDirectDmsAllowed(): boolean {
  return ambientRolloutStage() !== "sandbox";
}

/**
 * Resolve the current stage's watched channel names to Slack channel IDs, so
 * the events route can match against `event.channel` (always an ID, never a
 * name). Called from inside after() — not on the hot ack path — so the
 * per-channel lookup latency doesn't risk Slack's 3s response budget.
 * Unresolvable channels (bot not invited, doesn't exist yet) are silently
 * dropped — same fail-open posture as the rest of lib/slack.ts.
 */
export async function ambientWatchedChannelIds(): Promise<Set<string>> {
  const names = ambientWatchedChannels();
  const ids = await Promise.all(names.map((name) => getChannelIdByName(name)));
  return new Set(ids.filter((id): id is string => !!id));
}
