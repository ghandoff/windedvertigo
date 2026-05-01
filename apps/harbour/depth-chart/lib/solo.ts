import type { SOLOLevel } from "./types";

export interface SOLOLevelInfo {
  level: SOLOLevel;
  label: string;
  order: number;
  category: "surface" | "deep";
  description: string;
  color: string;
  student_response: string;
}

export const SOLO_LEVELS: Record<SOLOLevel, SOLOLevelInfo> = {
  pre_structural: {
    level: "pre_structural",
    label: "pre-structural",
    order: 0,
    category: "surface",
    description: "student misses the point entirely or provides irrelevant information",
    color: "var(--dc-solo-pre)",
    student_response: "the task is not engaged with appropriately",
  },
  uni_structural: {
    level: "uni_structural",
    label: "uni-structural",
    order: 1,
    category: "surface",
    description: "student focuses on one relevant aspect of the task",
    color: "var(--dc-solo-uni)",
    student_response: "one relevant piece of information is identified",
  },
  multi_structural: {
    level: "multi_structural",
    label: "multi-structural",
    order: 2,
    category: "surface",
    description: "student addresses several relevant aspects but treats them independently",
    color: "var(--dc-solo-multi)",
    student_response: "several relevant pieces are listed but not connected",
  },
  relational: {
    level: "relational",
    label: "relational",
    order: 3,
    category: "deep",
    description: "student integrates multiple aspects into a coherent whole, seeing relationships",
    color: "var(--dc-solo-relational)",
    student_response: "aspects are connected, causes are explained, meaning is constructed",
  },
  extended_abstract: {
    level: "extended_abstract",
    label: "extended abstract",
    order: 4,
    category: "deep",
    description: "student generalises beyond the given context, theorises, hypothesises, or transfers to new domains",
    color: "var(--dc-solo-extended)",
    student_response: "understanding is generalised to new contexts or used to create new meaning",
  },
};

/** all SOLO levels in ascending order */
export const SOLO_ORDER: SOLOLevel[] = [
  "pre_structural",
  "uni_structural",
  "multi_structural",
  "relational",
  "extended_abstract",
];

/** check if a SOLO level indicates deep learning (relational or extended abstract) */
export function is_deep_learning(level: SOLOLevel): boolean {
  return SOLO_LEVELS[level].category === "deep";
}

/** get SOLO level info */
export function get_solo_level(level: SOLOLevel): SOLOLevelInfo {
  return SOLO_LEVELS[level];
}
