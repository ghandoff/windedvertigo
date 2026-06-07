/**
 * cARL (research) tool definitions — Anthropic tool schema format.
 *
 * These tools call the port memory API (/api/carl/*) as server-to-server
 * requests authenticated with CMO_API_TOKEN.
 */

export const CARL_TOOLS = [
  {
    name: "carl_log_decision",
    description:
      "Log a research decision or conversation summary to cARL's memory. Use when a meaningful research direction is decided — a new domain to investigate, a finding that changes a design direction, a curriculum topic prioritised.",
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
          description: "Specific research decisions made.",
        },
        tags: {
          type: "array",
          items: { type: "string" },
          description:
            "Topic tags (e.g. ['threshold-concepts', 'UDL', 'play-based-learning', 'AI-in-ed']).",
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
    name: "carl_update_memory",
    description:
      "Update a working state fact in cARL's research memory. Use for facts about current research focus, knowledge gaps, active investigations.",
    input_schema: {
      type: "object" as const,
      properties: {
        key: {
          type: "string",
          description:
            "Slug key for this fact (e.g. 'current-focus', 'active-literature-review', 'gap-in-knowledge').",
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
    name: "carl_add_finding",
    description:
      "Add a research finding to cARL's knowledge base. Call this immediately when a significant finding surfaces — from a paper, a conversation, or cARL's own research. The finding is also auto-filed into the w.v Annotated Bibliography.",
    input_schema: {
      type: "object" as const,
      properties: {
        domain: {
          type: "string",
          description:
            "Research domain (e.g. 'threshold-concepts', 'play-based-learning', 'AI-in-education', 'UDL', 'cultural-responsiveness', 'assessment', 'learning-design').",
        },
        title: {
          type: "string",
          description: "Short title for this finding (used as a reference label).",
        },
        summary: {
          type: "string",
          description: "Clear, accessible summary of the finding in plain language.",
        },
        source: {
          type: "string",
          description:
            "Where this finding comes from (paper title, author, URL, or 'conversation with [name]').",
        },
        citation: {
          type: "string",
          description: "Full citation if this is from a publication (APA format preferred).",
        },
        relevance: {
          type: "string",
          description: "How this finding connects to what the team is building or doing.",
        },
        tags: {
          type: "array",
          items: { type: "string" },
          description: "Tags for searchability.",
        },
        connected_to: {
          type: "string",
          description:
            "Comma-separated finding IDs this connects to (from carl_search_findings). Omit if not linked.",
        },
      },
      required: ["domain", "title", "summary"],
    },
  },
  {
    name: "carl_search_findings",
    description:
      "Search cARL's knowledge base for existing findings. Always call this before answering research questions — the answer may already be in the library.",
    input_schema: {
      type: "object" as const,
      properties: {
        domain: {
          type: "string",
          description: "Filter by research domain. Omit to search across all domains.",
        },
        tags: {
          type: "string",
          description: "Comma-separated tags to filter by.",
        },
        search: {
          type: "string",
          description: "Free-text search across finding titles and summaries.",
        },
      },
    },
  },
  {
    name: "carl_curriculum",
    description:
      "Retrieve cARL's curriculum — the structured list of what has been studied, what is planned, and what knowledge gaps remain.",
    input_schema: {
      type: "object" as const,
      properties: {},
    },
  },
] as const;

export type CarlToolName = (typeof CARL_TOOLS)[number]["name"];
export const CARL_TOOL_NAMES = new Set<string>(CARL_TOOLS.map((t) => t.name));
