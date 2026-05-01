/**
 * Single source of truth for which fields the agent is allowed to write,
 * per resource.
 *
 * Shared between:
 *   - `tools/definitions.ts` (tool input_schema enum values)
 *   - `tools/executor.ts` (staging-gate whitelist check)
 *   - `tools/notion.ts` (execute function argument types)
 *
 * Keeping this in one place prevents drift — if the tool schema and the
 * runtime validation diverge, the agent can stage a write that the
 * execute function rejects, or accept a field the schema forbade.
 */

/**
 * Organization fields the agent may write via `updateOrganization`.
 *
 * Explicitly EXCLUDED (do NOT add here):
 *   - `organization` — renaming breaks relation displays and CRM continuity.
 *   - `contactIds`, `competitorIds` — graph rewiring is UI-only territory.
 *   - `relationship` — computed from the trio (connection + outreachStatus
 *     + friendship). The agent writes the inputs; the data layer derives
 *     the output.
 *   - `bespokeEmailCopy`, `outreachSuggestion` — templated fields managed
 *     by the campaign builder.
 *   - `enrichedAt`, `outreachReady` — enrichment pipeline fields.
 *   - `createdTime`, `lastEditedTime` — system.
 *   - `website`, `email`, `linkedinUrl` — contact details, easy for an
 *     agent to stamp wrong from conversational context.
 */
export const AGENT_WRITABLE_ORG_FIELDS = [
  "connection",
  "outreachStatus",
  "friendship",
  "fitRating",
  "marketSegment",
  "notes",
] as const;

export type AgentWritableOrgField = (typeof AGENT_WRITABLE_ORG_FIELDS)[number];

/**
 * Contact fields the agent may write via `updateContact`.
 *
 * Explicitly EXCLUDED (do NOT add here):
 *   - `name` — renaming a contact breaks relation displays and continuity
 *     across activities, campaigns, and organizations.
 *   - `organizationIds` — graph rewiring is UI-only territory; linking a
 *     contact to the wrong org silently skews pipeline views.
 *   - `nodeUserIds` — `node` is a Notion person-property that maps to the
 *     internal w.v collective owner. The agent should never reassign
 *     ownership from conversational context (and it requires a Notion
 *     user-ID lookup the agent doesn't have a tool for).
 *   - `contactType`, `contactWarmth`, `responsiveness`, `referralPotential`,
 *     `relationshipStage` — relationship-signal enums managed by the CRM
 *     UI + activity pipeline; too easy for an agent to mis-stamp from a
 *     single Slack message.
 *   - `lastContacted` — stamped automatically by the activity pipeline.
 *   - `linkedin`, `phoneNumber`, `profilePhotoUrl` — contact details, easy
 *     for an agent to stamp wrong from conversational context.
 *   - `createdTime`, `lastEditedTime` — system.
 *
 * What IS writable is deliberately narrow: three free-text fields a user
 * would reasonably ask the agent to update in prose ("change Meredith's
 * email to the new address", "her role is now Director of Programs",
 * "next step is to send the brief by Friday").
 *
 * The contact schema has no general-purpose "notes" field — `nextAction`
 * is the closest free-text column and is REPLACED (not appended) because
 * semantically it tracks the current next step, not a history log.
 */
export const AGENT_WRITABLE_CONTACT_FIELDS = [
  "email",
  "role",
  "nextAction",
] as const;

export type AgentWritableContactField =
  (typeof AGENT_WRITABLE_CONTACT_FIELDS)[number];
