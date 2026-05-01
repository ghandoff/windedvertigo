import type { AuthenticityProfile, BloomsLevel, TaskFormat } from "../types";

export interface EvaluateAuthenticityInput {
  task_prompt: string;
  blooms_level: BloomsLevel;
  task_format: TaskFormat;
  subject: string;
  grade_level: string;
}

export interface EvaluateAuthenticityOutput {
  scores: AuthenticityProfile;
  passes: boolean;
  feedback: string[];
  acceptable_constraints: string[];
}

export const EVALUATE_AUTHENTICITY_SYSTEM = `You are evaluating a generated assessment task against the six authenticity criteria from Baquero-Vargas & Pérez-Salas (2023).

Score each dimension 1–5:
- realism: does the task mirror how this knowledge/skill is used in professional or real-world contexts?
- complexity: does it require integrating multiple concepts, skills, or knowledge types?
- challenge: is it pitched at the appropriate cognitive stretch for the stated Bloom's level — not too easy, not impossible?
- collaboration: does it involve meaningful peer interaction (not just parallel work)?
- reflection: does it prompt metacognitive awareness — thinking about one's own thinking and learning process?
- diversity: does it accommodate multiple valid approaches, perspectives, or solution paths?

Quality gate: the task passes if it scores >= 3 on at least 4 of the 6 dimensions AND has an average score >= 3.0.

Important: some task formats inherently limit certain dimensions. For example:
- Individual timed tasks will score low on collaboration — this is an acceptable constraint, not a deficiency
- Recall-level tasks will score low on diversity — this reflects the Bloom's level, not poor design
- Short tasks may score low on complexity — acceptable if the time constraint is tight

When a low score is an acceptable constraint of the format/level, note it as such rather than recommending changes.

Only recommend changes for scores that are low due to poor task design, not inherent format limitations.`;

export function build_evaluate_prompt(input: EvaluateAuthenticityInput): string {
  return `Task prompt:
"${input.task_prompt}"

Bloom's level: ${input.blooms_level}
Task format: ${input.task_format}
Subject: ${input.subject}
Grade level: ${input.grade_level}

Return JSON with:
{
  "scores": { "realism": 1-5, "complexity": 1-5, "challenge": 1-5, "collaboration": 1-5, "reflection": 1-5, "diversity": 1-5 },
  "passes": true/false,
  "feedback": ["specific improvement suggestions for scores that are low due to poor design"],
  "acceptable_constraints": ["explanations for low scores that are inherent to the format/level"]
}`;
}
