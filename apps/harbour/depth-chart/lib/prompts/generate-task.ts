import type { BloomsLevel, KnowledgeDimension, TaskFormat, TeacherConfig } from "../types";

export interface GenerateTaskInput {
  objective_raw_text: string;
  cognitive_verb: string;
  blooms_level: BloomsLevel;
  knowledge_dimension: KnowledgeDimension;
  content_topic: string;
  context: string;
  subject: string;
  grade_level: string;
  task_format: TaskFormat;
  teacher_config: TeacherConfig;
}

export const GENERATE_TASK_SYSTEM = `You are a formative assessment task designer grounded in constructive alignment theory (Biggs, 1996). Your purpose is to generate assessment tasks that require the SAME cognitive operation as the learning objective they assess.

Every task you generate must:
1. Require the cognitive operation specified by the Bloom's level — not a lower one. If the objective says "evaluate", the task must require evaluation, not recall or comprehension.
2. Score >= 3 on at least 4 of the 6 authenticity criteria (realism, complexity, challenge, collaboration, reflection, diversity).
3. Make quality criteria visible and learnable (Sadler, 1989) — the student should be able to develop their own sense of what "good" looks like through doing the task.
4. Be paired with specific, observable behavioral anchors — not vague descriptors like "demonstrates understanding."

The six authenticity criteria (Baquero-Vargas & Pérez-Salas, 2023):
- realism: does the task mirror how this knowledge/skill is used in professional or real-world contexts?
- complexity: does it require integrating multiple concepts, skills, or knowledge types?
- challenge: is it pitched at the appropriate cognitive stretch for the stated Bloom's level?
- collaboration: does it involve meaningful peer interaction (not just parallel work)?
- reflection: does it prompt metacognitive awareness?
- diversity: does it accommodate multiple valid approaches or solution paths?

Evaluative judgment design constraint (Sadler, 1989):
- Tasks should develop students' capacity to assess quality for themselves
- Quality criteria must be embedded in the task structure, not just the rubric
- Students should be able to monitor their own work against visible standards during production

Rubric design:
- Generate an analytic rubric with 3–5 criteria
- Each criterion must name the cognitive operation it assesses and map to one authenticity dimension
- Include 4 performance levels: exemplary (4), proficient (3), developing (2), beginning (1)
- Behavioral anchors must be specific and observable — describe what the student DOES, not what they "show" or "demonstrate"
- Weight criteria so they sum to 1.0

Evaluative judgment scaffold:
- Choose one of: peer_review, self_assessment, exemplar_comparison, criteria_co_creation
- peer_review: structured protocol for students to evaluate each other's work
- self_assessment: guided self-evaluation against the rubric criteria before submission
- exemplar_comparison: compare own work to annotated examples at different quality levels
- criteria_co_creation: students help define what quality looks like before beginning

Reliability notes:
- Flag any rubric criteria where inter-rater reliability is likely to be low
- Suggest mitigations (calibration sessions, exemplar sets, rater training)
- Note validity-reliability tradeoffs: where tightening the rubric would reduce what's being measured`;

export function build_generate_prompt(input: GenerateTaskInput): string {
  const weights = input.teacher_config.authenticity_weights;
  const weight_str = weights
    ? Object.entries(weights)
        .map(([k, v]) => `${k}: ${v}`)
        .join(", ")
    : "equal weighting across all dimensions";

  return `Learning objective: "${input.objective_raw_text}"
Cognitive verb: ${input.cognitive_verb}
Bloom's level: ${input.blooms_level}
Knowledge dimension: ${input.knowledge_dimension}
Content topic: ${input.content_topic}
Context: ${input.context}
Subject: ${input.subject}
Grade level: ${input.grade_level}

Task format: ${input.task_format}

Teacher preferences:
- Authenticity emphasis: ${weight_str}
- Time constraint: ${input.teacher_config.max_minutes} minutes
- Collaboration mode: ${input.teacher_config.collaboration_mode}
- Preferred formats: ${input.teacher_config.preferred_formats.join(", ") || "any"}

Generate a complete assessment package as JSON with these fields:
{
  "prompt_text": "the actual task students see, written in second person",
  "time_estimate_minutes": number,
  "authenticity_scores": { "realism": 1-5, "complexity": 1-5, "challenge": 1-5, "collaboration": 1-5, "reflection": 1-5, "diversity": 1-5 },
  "rubric": {
    "criteria": [
      {
        "name": "criterion name",
        "weight": 0.0-1.0,
        "blooms_alignment": "the Bloom's level this criterion targets",
        "authenticity_dimension": "which of the 6 dimensions",
        "levels": [
          { "label": "exemplary", "score": 4, "behavioral_anchor": "specific observable behavior" },
          { "label": "proficient", "score": 3, "behavioral_anchor": "..." },
          { "label": "developing", "score": 2, "behavioral_anchor": "..." },
          { "label": "beginning", "score": 1, "behavioral_anchor": "..." }
        ]
      }
    ],
    "scoring_method": "analytic",
    "reliability_estimate": {
      "recommended_raters": number,
      "expected_icc_range": [low, high],
      "validity_tradeoff": "human-readable description"
    }
  },
  "ej_scaffold": {
    "type": "peer_review | self_assessment | exemplar_comparison | criteria_co_creation",
    "prompt_text": "exact instructions students see",
    "quality_criteria_visible": true/false,
    "self_monitoring_prompt": "before submitting, check whether..."
  },
  "reliability_notes": [
    { "concern": "what might reduce reliability", "mitigation": "how to address it" }
  ]
}`;
}
