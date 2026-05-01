import type { WebbDOKLevel } from "./types";

export interface DOKLevelInfo {
  level: WebbDOKLevel;
  label: string;
  order: number;
  category: "low_complexity" | "high_complexity";
  description: string;
  color: string;
  example_tasks: string[];
}

export const DOK_LEVELS: Record<WebbDOKLevel, DOKLevelInfo> = {
  "1": {
    level: "1",
    label: "recall & reproduction",
    order: 1,
    category: "low_complexity",
    description: "recall a fact, definition, term, or perform a simple procedure",
    color: "var(--dc-dok-1)",
    example_tasks: [
      "list the steps of mitosis",
      "define supply and demand",
      "identify the formula for area",
      "recall dates of key events",
    ],
  },
  "2": {
    level: "2",
    label: "skills & concepts",
    order: 2,
    category: "low_complexity",
    description: "use information or conceptual knowledge requiring basic reasoning or routine problem-solving",
    color: "var(--dc-dok-2)",
    example_tasks: [
      "classify organisms into kingdoms",
      "compare two characters in a novel",
      "organise data into a graph",
      "solve a multi-step equation",
    ],
  },
  "3": {
    level: "3",
    label: "strategic thinking",
    order: 3,
    category: "high_complexity",
    description: "complex reasoning, planning, developing explanations, and using evidence",
    color: "var(--dc-dok-3)",
    example_tasks: [
      "draw conclusions from multiple sources",
      "develop a logical argument with evidence",
      "solve non-routine problems requiring multiple approaches",
      "analyse an author's purpose across texts",
    ],
  },
  "4": {
    level: "4",
    label: "extended thinking",
    order: 4,
    category: "high_complexity",
    description: "investigation, complex reasoning over time, cross-disciplinary connections, and design",
    color: "var(--dc-dok-4)",
    example_tasks: [
      "design and conduct an experiment",
      "synthesise information across disciplines",
      "create an original model to explain a phenomenon",
      "develop and defend a research-based position",
    ],
  },
};

/** all DOK levels in ascending order */
export const DOK_ORDER: WebbDOKLevel[] = ["1", "2", "3", "4"];

/** check if a DOK level is high complexity (strategic or extended thinking) */
export function is_complex(level: WebbDOKLevel): boolean {
  return DOK_LEVELS[level].category === "high_complexity";
}

/** get DOK level info */
export function get_dok_level(level: WebbDOKLevel): DOKLevelInfo {
  return DOK_LEVELS[level];
}
