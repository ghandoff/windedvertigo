// ── Bloom's taxonomy ──────────────────────────────────────────────

export type BloomsLevel =
  | "remember"
  | "understand"
  | "apply"
  | "analyse"
  | "evaluate"
  | "create";

export type KnowledgeDimension =
  | "factual"
  | "conceptual"
  | "procedural"
  | "metacognitive";

export type WebbDOKLevel = "1" | "2" | "3" | "4";

export type SOLOLevel =
  | "pre_structural"
  | "uni_structural"
  | "multi_structural"
  | "relational"
  | "extended_abstract";

// ── Core entities ─────────────────────────────────────────────────

export interface LessonPlan {
  id: string;
  teacher_id: string;
  title: string;
  subject: string;
  grade_level: string;
  raw_text: string;
  objectives: LearningObjective[];
  created_at: string;
  alignment_report: AlignmentReport;
}

export interface LearningObjective {
  id: string;
  lesson_plan_id: string;
  raw_text: string;
  cognitive_verb: string;
  blooms_level: BloomsLevel;
  knowledge_dimension: KnowledgeDimension;
  content_topic: string;
  context: string;
  confidence: number;
  webb_dok?: WebbDOKLevel;
  solo_level?: SOLOLevel;
  tasks: GeneratedTask[];
}

// ── Generated artifacts ───────────────────────────────────────────

export type TaskFormat =
  // LOCS formats (remember, understand, apply)
  | "concept_map"
  | "annotated_diagram"
  | "worked_example"
  | "case_application"
  // HOCS formats (analyse, evaluate, create)
  | "comparative_analysis"
  | "scenario_judgment"
  | "peer_review_protocol"
  | "design_brief"
  | "position_paper"
  | "oral_defense"
  | "portfolio_entry";

export interface GeneratedTask {
  id: string;
  objective_id: string;
  blooms_level: BloomsLevel;
  task_format: TaskFormat;
  prompt_text: string;
  time_estimate_minutes: number;
  authenticity_scores: AuthenticityProfile;
  rubric: AnalyticRubric;
  ej_scaffold: EJScaffold;
  reliability_notes: ReliabilityNote[];
}

export interface AuthenticityProfile {
  realism: number;
  complexity: number;
  challenge: number;
  collaboration: number;
  reflection: number;
  diversity: number;
}

// ── Rubric ────────────────────────────────────────────────────────

export interface AnalyticRubric {
  id: string;
  task_id: string;
  criteria: RubricCriterion[];
  scoring_method: "analytic" | "holistic";
  reliability_estimate: ReliabilityEstimate;
}

export interface RubricCriterion {
  name: string;
  weight: number;
  blooms_alignment: BloomsLevel;
  authenticity_dimension: keyof AuthenticityProfile;
  levels: PerformanceLevel[];
}

export interface PerformanceLevel {
  label: "exemplary" | "proficient" | "developing" | "beginning";
  score: number;
  behavioral_anchor: string;
}

export interface ReliabilityEstimate {
  recommended_raters: number;
  expected_icc_range: [number, number];
  validity_tradeoff: string;
}

// ── Evaluative judgment scaffolds ─────────────────────────────────

export type EJScaffoldType =
  | "peer_review"
  | "self_assessment"
  | "exemplar_comparison"
  | "criteria_co_creation";

export interface EJScaffold {
  type: EJScaffoldType;
  prompt_text: string;
  quality_criteria_visible: boolean;
  self_monitoring_prompt: string;
}

// ── Alignment report ──────────────────────────────────────────────

export interface AlignmentReport {
  objectives_count: number;
  covered_count: number;
  gaps: AlignmentGap[];
  blooms_distribution: Record<BloomsLevel, number>;
  hocs_percentage: number;
  webb_distribution?: Record<WebbDOKLevel, number>;
  solo_distribution?: Record<SOLOLevel, number>;
  harbour_recommendations?: HarbourRecommendation[];
}

export interface HarbourRecommendation {
  app: "raft-house" | "creaseworks" | "vertigo-vault";
  activity_slug: string;
  activity_name: string;
  reason: string;
  url: string;
  blooms_levels: BloomsLevel[];
  subject_tags: string[];
  duration_minutes?: number;
  group_size?: string;
}

export interface AlignmentGap {
  objective_id: string;
  issue: "no_assessment" | "blooms_mismatch" | "locs_only";
  suggestion: string;
}

export interface ReliabilityNote {
  concern: string;
  mitigation: string;
}

// ── Teacher configuration ─────────────────────────────────────────

export interface TeacherConfig {
  authenticity_weights: Partial<AuthenticityProfile>;
  max_minutes: number;
  collaboration_mode: "individual" | "pairs" | "small_group" | "whole_class";
  preferred_formats: TaskFormat[];
  frameworks: {
    webb_dok: boolean;
    solo: boolean;
  };
}
