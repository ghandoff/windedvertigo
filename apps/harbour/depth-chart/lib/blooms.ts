import type { BloomsLevel, TaskFormat } from "./types";

export interface BloomsLevelInfo {
  level: BloomsLevel;
  label: string;
  order: number;
  category: "locs" | "hocs";
  description: string;
  color: string;
  example_verbs: string[];
  valid_formats: TaskFormat[];
}

export const BLOOMS_LEVELS: Record<BloomsLevel, BloomsLevelInfo> = {
  remember: {
    level: "remember",
    label: "remember",
    order: 1,
    category: "locs",
    description: "retrieve relevant knowledge from long-term memory",
    color: "var(--dc-bloom-remember)",
    example_verbs: ["list", "define", "recall", "name", "identify", "recognise", "state", "label"],
    valid_formats: ["concept_map", "annotated_diagram"],
  },
  understand: {
    level: "understand",
    label: "understand",
    order: 2,
    category: "locs",
    description: "construct meaning from instructional messages",
    color: "var(--dc-bloom-understand)",
    example_verbs: ["explain", "summarise", "classify", "describe", "interpret", "paraphrase", "compare"],
    valid_formats: ["concept_map", "annotated_diagram", "worked_example"],
  },
  apply: {
    level: "apply",
    label: "apply",
    order: 3,
    category: "locs",
    description: "carry out or use a procedure in a given situation",
    color: "var(--dc-bloom-apply)",
    example_verbs: ["solve", "demonstrate", "use", "execute", "implement", "calculate", "apply"],
    valid_formats: ["worked_example", "case_application"],
  },
  analyse: {
    level: "analyse",
    label: "analyse",
    order: 4,
    category: "hocs",
    description: "break material into constituent parts and determine how parts relate",
    color: "var(--dc-bloom-analyse)",
    example_verbs: ["compare", "differentiate", "examine", "attribute", "deconstruct", "distinguish", "organise"],
    valid_formats: ["comparative_analysis", "scenario_judgment", "peer_review_protocol"],
  },
  evaluate: {
    level: "evaluate",
    label: "evaluate",
    order: 5,
    category: "hocs",
    description: "make judgments based on criteria and standards",
    color: "var(--dc-bloom-evaluate)",
    example_verbs: ["critique", "judge", "assess", "justify", "argue", "defend", "appraise", "prioritise"],
    valid_formats: ["scenario_judgment", "peer_review_protocol", "position_paper", "oral_defense"],
  },
  create: {
    level: "create",
    label: "create",
    order: 6,
    category: "hocs",
    description: "put elements together to form a coherent or functional whole",
    color: "var(--dc-bloom-create)",
    example_verbs: ["design", "construct", "formulate", "compose", "produce", "plan", "devise", "synthesise"],
    valid_formats: ["design_brief", "position_paper", "portfolio_entry", "oral_defense"],
  },
};

/** all Bloom's levels in ascending order */
export const BLOOMS_ORDER: BloomsLevel[] = [
  "remember", "understand", "apply", "analyse", "evaluate", "create",
];

/** check if a level is higher-order cognitive skills */
export function is_hocs(level: BloomsLevel): boolean {
  return BLOOMS_LEVELS[level].category === "hocs";
}

/** get valid task formats for a given Bloom's level */
export function get_valid_formats(level: BloomsLevel): TaskFormat[] {
  return BLOOMS_LEVELS[level].valid_formats;
}
