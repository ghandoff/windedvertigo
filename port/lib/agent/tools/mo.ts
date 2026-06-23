/**
 * Mo (CMO) tool definitions — Anthropic tool schema format.
 *
 * These tools call the port memory API (/api/cmo/*) as server-to-server
 * requests authenticated with CMO_API_TOKEN. No staged confirmation — Mo
 * is trusted to write its own memory.
 */

export const MO_TOOLS = [
  {
    name: "cmo_log_decision",
    description:
      "Log a marketing decision or conversation summary to Mo's memory. Call this immediately when a direction is chosen, a decision is made, or a meaningful shift occurs in the conversation. Don't batch at the end — log as you go.",
    input_schema: {
      type: "object" as const,
      properties: {
        who: {
          type: "string",
          description:
            "Team member this conversation is with (e.g. 'garrett', 'payton', 'maria').",
        },
        summary: {
          type: "string",
          description:
            "One-paragraph summary of what was discussed and decided.",
        },
        decisions: {
          type: "array",
          items: { type: "string" },
          description:
            "List of specific decisions made (each a short phrase, e.g. 'linkedin content angle: ecosystem over product').",
        },
        tags: {
          type: "array",
          items: { type: "string" },
          description:
            "Topic tags for searchability (e.g. ['harbour', 'linkedin', 'pipeline']).",
        },
        session_type: {
          type: "string",
          enum: ["slack", "web", "cowork"],
          description: "Channel this conversation happened in.",
        },
      },
      required: ["who", "summary"],
    },
  },
  {
    name: "cmo_update_memory",
    description:
      "Update a working state fact in Mo's memory (key/value). Use for facts that change over time — current focus, campaign status, pipeline state. Replaces any previous value for the same key.",
    input_schema: {
      type: "object" as const,
      properties: {
        key: {
          type: "string",
          description:
            "Slug key for this fact (e.g. 'payton-focus', 'harbour-launch-status', 'q2-revenue-target').",
        },
        value: {
          type: "string",
          description: "Current value for this fact.",
        },
        updated_by: {
          type: "string",
          description: "Name of the team member whose conversation prompted this update.",
        },
      },
      required: ["key", "value"],
    },
  },
  {
    name: "cmo_request_research",
    description:
      "Ask cARL to research a topic that would deepen Mo's marketing and strategy expertise. cARL queues it as priority 1 and posts a digest to #canon when done. Use when you need theoretical grounding before a strategy call, campaign direction, or positioning decision — e.g. consumer behaviour research for a specific sector, evidence on pricing psychology, or brand frameworks for mission-led organisations.",
    input_schema: {
      type: "object" as const,
      properties: {
        domain: {
          type: "string",
          description:
            "Canonical cARL domain label (e.g. 'mo · strategy', 'mo · audience & behaviour', 'mo · digital & growth', 'mo · communications'). Use a 'mo · *' domain so findings flow back into Mo's briefing.",
        },
        topic: {
          type: "string",
          description:
            "Specific topic or question (e.g. 'consumer behaviour in mission-driven social enterprise', 'evidence-based pricing psychology for non-profit memberships').",
        },
        context: {
          type: "string",
          description:
            "Why this is needed — the campaign, decision, or question driving the request. Helps cARL prioritise and frame the research.",
        },
        key_works: {
          type: "array",
          items: { type: "string" },
          description: "Known papers, authors, or frameworks to anchor the search (optional).",
        },
      },
      required: ["domain", "topic"],
    },
  },
] as const;

export type MoToolName = (typeof MO_TOOLS)[number]["name"];
export const MO_TOOL_NAMES = new Set<string>(MO_TOOLS.map((t) => t.name));
