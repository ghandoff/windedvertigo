import type { LearningObjective, TeacherConfig } from "../types";

export interface ParseObjectivesInput {
  raw_text: string;
  subject: string;
  grade_level: string;
  frameworks?: TeacherConfig["frameworks"];
}

export type ParseObjectivesOutput = Omit<LearningObjective, "lesson_plan_id" | "tasks">[];

export const PARSE_OBJECTIVES_SYSTEM = `You are parsing a lesson plan or syllabus to extract structured learning objectives.

For each objective you identify, extract:
- raw_text: the original text of the objective as written
- cognitive_verb: the verb that defines what students will DO (e.g., "analyse", "design", "explain")
- blooms_level: the Bloom's taxonomy level — one of: remember, understand, apply, analyse, evaluate, create
- knowledge_dimension: one of: factual, conceptual, procedural, metacognitive
- content_topic: the domain knowledge involved (e.g., "causes of the French Revolution")
- context: any conditions, tools, or constraints mentioned (e.g., "using primary source documents")
- confidence: 0.0–1.0 indicating how confident you are in the classification

If the lesson plan uses vague language like "students will learn about X" or "students will be familiar with Y", flag it as implicit:
- Infer the most likely Bloom's level from surrounding context
- Set confidence < 0.8
- Use "understand" as the default if no cognitive verb is present

Rules:
- Extract EVERY learning objective, including those embedded in activity descriptions
- Do not invent objectives that aren't in the text
- If an objective contains multiple cognitive verbs at different levels, split it into separate objectives
- Preserve the original wording in raw_text exactly as written`;

const WEBB_DOK_BLOCK = `

If Webb's Depth of Knowledge analysis is requested, also classify each objective:
- webb_dok: complexity level "1", "2", "3", or "4"
  1 = recall & reproduction (facts, definitions, simple procedures)
  2 = skills & concepts (basic reasoning, routine problem-solving)
  3 = strategic thinking (complex reasoning, planning, evidence use)
  4 = extended thinking (investigation, design, cross-disciplinary connections)
Note: DOK measures task COMPLEXITY, not difficulty. A hard recall task is still DOK 1.
A "remember" objective (Bloom's) can be DOK 2 if it requires recognising patterns across multiple sources.`;

const SOLO_BLOCK = `

If SOLO taxonomy analysis is requested, also classify each objective:
- solo_level: depth of understanding required
  "pre_structural" = task not engaged appropriately
  "uni_structural" = focuses on one relevant aspect
  "multi_structural" = several aspects, treated independently
  "relational" = aspects integrated into coherent whole
  "extended_abstract" = generalised to new domain or context
SOLO measures the STRUCTURE of the learning outcome, not just the cognitive operation.
Surface learning (uni/multi-structural) lists ideas; deep learning (relational/extended abstract) connects them.`;

export function build_parse_prompt(input: ParseObjectivesInput): string {
  const framework_fields: string[] = [];
  let framework_context = "";

  if (input.frameworks?.webb_dok) {
    framework_fields.push("webb_dok");
    framework_context += WEBB_DOK_BLOCK;
  }
  if (input.frameworks?.solo) {
    framework_fields.push("solo_level");
    framework_context += SOLO_BLOCK;
  }

  const base_fields = "id (generate a short unique string), raw_text, cognitive_verb, blooms_level, knowledge_dimension, content_topic, context, confidence";
  const all_fields = framework_fields.length > 0
    ? `${base_fields}, ${framework_fields.join(", ")}`
    : base_fields;

  return `Lesson plan text:
${input.raw_text}

Subject: ${input.subject}
Grade level: ${input.grade_level}${framework_context}

Return a JSON array of objectives. Each object must have: ${all_fields}.

Flag any objectives that appear to lack assessment coverage by adding a field "gap_flag": true.`;
}
