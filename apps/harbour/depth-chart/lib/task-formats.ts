import type { TaskFormat, BloomsLevel } from "./types";
import { BLOOMS_LEVELS } from "./blooms";

export interface TaskFormatInfo {
  format: TaskFormat;
  label: string;
  description: string;
  typical_minutes: [number, number];
  collaboration_compatible: boolean;
}

export const TASK_FORMATS: Record<TaskFormat, TaskFormatInfo> = {
  // LOCS formats
  concept_map: {
    format: "concept_map",
    label: "concept map",
    description: "visual representation of relationships between concepts, showing how ideas connect",
    typical_minutes: [15, 30],
    collaboration_compatible: true,
  },
  annotated_diagram: {
    format: "annotated_diagram",
    label: "annotated diagram",
    description: "labeled visual with explanatory notes identifying components and their functions",
    typical_minutes: [15, 25],
    collaboration_compatible: false,
  },
  worked_example: {
    format: "worked_example",
    label: "worked example",
    description: "step-by-step solution to a problem, demonstrating the procedure and reasoning",
    typical_minutes: [20, 40],
    collaboration_compatible: false,
  },
  case_application: {
    format: "case_application",
    label: "case application",
    description: "apply learned procedures or concepts to a realistic scenario with defined constraints",
    typical_minutes: [25, 45],
    collaboration_compatible: true,
  },
  // HOCS formats
  comparative_analysis: {
    format: "comparative_analysis",
    label: "comparative analysis",
    description: "systematic comparison of two or more items, identifying patterns, differences, and relationships",
    typical_minutes: [30, 60],
    collaboration_compatible: true,
  },
  scenario_judgment: {
    format: "scenario_judgment",
    label: "scenario-based judgment",
    description: "present a realistic scenario requiring evaluation and decision-making with justification",
    typical_minutes: [20, 40],
    collaboration_compatible: true,
  },
  peer_review_protocol: {
    format: "peer_review_protocol",
    label: "peer review protocol",
    description: "structured process for students to evaluate each other's work against explicit criteria",
    typical_minutes: [30, 50],
    collaboration_compatible: true,
  },
  design_brief: {
    format: "design_brief",
    label: "design brief",
    description: "create a plan or prototype that addresses a defined problem within specified constraints",
    typical_minutes: [45, 90],
    collaboration_compatible: true,
  },
  position_paper: {
    format: "position_paper",
    label: "position paper",
    description: "construct and defend an argument using evidence, addressing counterarguments",
    typical_minutes: [45, 90],
    collaboration_compatible: false,
  },
  oral_defense: {
    format: "oral_defense",
    label: "oral defense",
    description: "present and defend work or conclusions to an audience, responding to questions",
    typical_minutes: [15, 30],
    collaboration_compatible: true,
  },
  portfolio_entry: {
    format: "portfolio_entry",
    label: "portfolio entry",
    description: "curated artifact with reflective commentary demonstrating growth and competence",
    typical_minutes: [30, 60],
    collaboration_compatible: false,
  },
};

/** get all formats valid for a given Bloom's level, optionally filtered by collaboration */
export function get_formats_for_level(
  level: BloomsLevel,
  collaboration_only?: boolean
): TaskFormatInfo[] {
  const valid = BLOOMS_LEVELS[level].valid_formats as TaskFormat[];
  return valid
    .map((f) => TASK_FORMATS[f])
    .filter((f) => !collaboration_only || f.collaboration_compatible);
}
