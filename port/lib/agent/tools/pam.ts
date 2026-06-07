/**
 * PaM (PM) tool definitions — Anthropic tool schema format.
 *
 * These tools call the port memory API (/api/pam/*) as server-to-server
 * requests authenticated with CMO_API_TOKEN.
 */

export const PAM_TOOLS = [
  {
    name: "pam_log_decision",
    description:
      "Log a project decision or conversation summary to PaM's memory. Use when a meaningful decision is made that affects project work — a new approach agreed, a priority shift, a scope clarification.",
    input_schema: {
      type: "object" as const,
      properties: {
        who: {
          type: "string",
          description: "Team member this conversation is with.",
        },
        summary: {
          type: "string",
          description: "One-paragraph summary of what was discussed and decided.",
        },
        decisions: {
          type: "array",
          items: { type: "string" },
          description: "Specific decisions made (each a short phrase).",
        },
        tags: {
          type: "array",
          items: { type: "string" },
          description: "Topic tags (e.g. ['harbour', 'timeline', 'maria']).",
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
    name: "pam_update_memory",
    description:
      "Update a working state fact in PaM's memory. Use for facts about team capacity, project status, or working patterns that change over time.",
    input_schema: {
      type: "object" as const,
      properties: {
        key: {
          type: "string",
          description:
            "Slug key for this fact (e.g. 'garrett-capacity', 'harbour-timeline', 'whirlpool-decisions').",
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
    name: "pam_create_commitment",
    description:
      "Create a new commitment when a team member commits to something in conversation. Call this immediately when someone says 'I'll have X done by Y' or 'I'm going to do Z'. Don't wait — create the commitment while you remember the context.",
    input_schema: {
      type: "object" as const,
      properties: {
        who: {
          type: "string",
          description: "Person making the commitment (e.g. 'garrett', 'payton', 'maria').",
        },
        what: {
          type: "string",
          description: "What they committed to do (clear, specific description).",
        },
        due_date: {
          type: "string",
          description: "ISO date string (YYYY-MM-DD) when this is due. Omit if no date was given.",
        },
        start_date: {
          type: "string",
          description: "ISO date string (YYYY-MM-DD) when they plan to start. Omit if not mentioned.",
        },
        source: {
          type: "string",
          description:
            "Where this commitment was made (e.g. 'wednesday whirlpool', 'slack DM', 'web chat with PaM').",
        },
        depends_on: {
          type: "string",
          description:
            "What needs to happen first, or who else is involved. Omit if no dependencies.",
        },
      },
      required: ["who", "what"],
    },
  },
  {
    name: "pam_update_commitment",
    description:
      "Update an existing commitment — change its status, add a blocker, or record completion. Use pam_list_commitments first to find the commitment ID.",
    input_schema: {
      type: "object" as const,
      properties: {
        id: {
          type: "string",
          description: "Commitment ID (UUID from pam_list_commitments).",
        },
        status: {
          type: "string",
          enum: ["not_started", "in_progress", "blocked", "done", "cancelled"],
          description: "New status.",
        },
        blocker: {
          type: "string",
          description: "What is blocking this (if status is 'blocked').",
        },
        what: {
          type: "string",
          description: "Update the description of the commitment.",
        },
        due_date: {
          type: "string",
          description: "Updated due date (ISO YYYY-MM-DD).",
        },
      },
      required: ["id"],
    },
  },
  {
    name: "pam_list_commitments",
    description:
      "List commitments — optionally filtered by person and/or status. Use this to answer 'what's on my plate?' or to check existing commitments before creating a duplicate.",
    input_schema: {
      type: "object" as const,
      properties: {
        who: {
          type: "string",
          description: "Filter by team member name. Omit to see all commitments.",
        },
        status: {
          type: "string",
          enum: ["not_started", "in_progress", "blocked", "done", "cancelled"],
          description: "Filter by status. Omit for all statuses.",
        },
      },
    },
  },
] as const;

export type PamToolName = (typeof PAM_TOOLS)[number]["name"];
export const PAM_TOOL_NAMES = new Set<string>(PAM_TOOLS.map((t) => t.name));
