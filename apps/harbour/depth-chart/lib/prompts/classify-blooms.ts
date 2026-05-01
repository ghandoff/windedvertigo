import type { BloomsLevel, KnowledgeDimension, WebbDOKLevel, SOLOLevel, TeacherConfig } from "../types";

export interface ClassifyInput {
  objective_text: string;
  cognitive_verb: string;
  subject: string;
  grade_level: string;
  frameworks?: TeacherConfig["frameworks"];
}

export interface ClassifyOutput {
  blooms_level: BloomsLevel;
  knowledge_dimension: KnowledgeDimension;
  confidence: number;
  reasoning: string;
  alternative_level: BloomsLevel | null;
  webb_dok?: WebbDOKLevel;
  webb_dok_reasoning?: string;
  solo_level?: SOLOLevel;
  solo_reasoning?: string;
}

export const CLASSIFY_BLOOMS_SYSTEM = `You are a Bloom's taxonomy classifier. Given a learning objective and its cognitive action verb, determine the precise Bloom's level and knowledge dimension.

Bloom's cognitive levels (ascending):
1. remember — retrieve from memory (list, define, recall, name, identify)
2. understand — construct meaning (explain, summarise, classify, describe, interpret)
3. apply — use in a new situation (solve, demonstrate, use, execute, implement)
4. analyse — break into parts and determine relationships (compare, differentiate, examine, attribute)
5. evaluate — make judgments based on criteria (critique, judge, assess, justify, argue)
6. create — produce something new (design, construct, formulate, compose, plan)

Knowledge dimensions:
- factual: terminology, specific details
- conceptual: categories, principles, theories, models
- procedural: techniques, methods, algorithms
- metacognitive: self-knowledge, cognitive strategies

Important distinctions:
- "compare" at the understand level means identifying similarities/differences; at the analyse level it means systematic decomposition of structure
- "describe" is typically understand; "describe how X causes Y" may be analyse
- Context matters: "apply the formula" is apply; "apply ethical reasoning to a novel dilemma" is evaluate
- The verb alone is not sufficient — consider what cognitive operation the full objective requires

Return your classification with a confidence score (0.0–1.0) and brief reasoning.
If the verb is ambiguous, provide an alternative_level with the next most likely classification.`;

const CLASSIFY_DOK_ADDENDUM = `

Also classify using Webb's Depth of Knowledge:
- DOK 1: recall & reproduction (facts, definitions, simple procedures)
- DOK 2: skills & concepts (basic reasoning, routine problem-solving)
- DOK 3: strategic thinking (complex reasoning, planning, evidence use)
- DOK 4: extended thinking (investigation, design, cross-disciplinary connections)

IMPORTANT: Bloom's and DOK are NOT the same dimension. A "remember" task can be DOK 2 if it requires recognising patterns across multiple sources. DOK measures task COMPLEXITY, Bloom's measures cognitive OPERATION.

Return webb_dok ("1","2","3","4") and webb_dok_reasoning.`;

const CLASSIFY_SOLO_ADDENDUM = `

Also classify using the SOLO Taxonomy:
- pre_structural: task not engaged appropriately
- uni_structural: one relevant aspect addressed
- multi_structural: several aspects, treated independently
- relational: aspects integrated into coherent whole
- extended_abstract: generalised beyond given context

SOLO measures the STRUCTURE of the expected response, not the cognitive operation. A task requiring students to "list three causes" is multi_structural even if Bloom's classifies the verb as "analyse."

Return solo_level and solo_reasoning.`;

export function build_classify_prompt(input: ClassifyInput): string {
  let addendum = "";
  const extra_fields: string[] = [];

  if (input.frameworks?.webb_dok) {
    addendum += CLASSIFY_DOK_ADDENDUM;
    extra_fields.push("webb_dok", "webb_dok_reasoning");
  }
  if (input.frameworks?.solo) {
    addendum += CLASSIFY_SOLO_ADDENDUM;
    extra_fields.push("solo_level", "solo_reasoning");
  }

  const base_fields = "blooms_level, knowledge_dimension, confidence, reasoning, alternative_level (or null)";
  const all_fields = extra_fields.length > 0
    ? `${base_fields}, ${extra_fields.join(", ")}`
    : base_fields;

  return `Objective: "${input.objective_text}"
Cognitive verb: "${input.cognitive_verb}"
Subject: ${input.subject}
Grade level: ${input.grade_level}${addendum}

Return JSON with: ${all_fields}.`;
}
