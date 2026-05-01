import { sql } from "@/lib/db";
import type {
  LearningObjective,
  GeneratedTask,
  BloomsLevel,
  KnowledgeDimension,
} from "@/lib/types";

// ── plans ──────────────────────────────────────────────────────────

export async function create_plan(
  user_id: string,
  title: string,
  subject: string,
  grade_level: string,
  raw_text: string,
  source_format: string = "text"
) {
  const r = await sql.query(
    `INSERT INTO dc_plans (user_id, title, subject, grade_level, raw_text, source_format)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id`,
    [user_id, title, subject, grade_level, raw_text, source_format]
  );
  return r.rows[0].id as string;
}

export async function get_plan(plan_id: string, user_id: string) {
  const r = await sql.query(
    "SELECT * FROM dc_plans WHERE id = $1 AND user_id = $2",
    [plan_id, user_id]
  );
  return r.rows[0] ?? null;
}

export async function get_plans_for_user(user_id: string, limit = 50) {
  const r = await sql.query(
    `SELECT p.id, p.title, p.subject, p.grade_level, p.source_format, p.created_at,
            (SELECT count(*) FROM dc_objectives o WHERE o.plan_id = p.id) as objectives_count
     FROM dc_plans p
     WHERE p.user_id = $1
     ORDER BY p.created_at DESC
     LIMIT $2`,
    [user_id, limit]
  );
  return r.rows;
}

export async function delete_plan(plan_id: string, user_id: string) {
  await sql.query(
    "DELETE FROM dc_plans WHERE id = $1 AND user_id = $2",
    [plan_id, user_id]
  );
}

export async function count_plans_this_month(user_id: string) {
  const r = await sql.query(
    `SELECT count(*) as cnt FROM dc_plans
     WHERE user_id = $1
     AND created_at >= date_trunc('month', now())`,
    [user_id]
  );
  return parseInt(r.rows[0].cnt, 10);
}

// ── objectives ─────────────────────────────────────────────────────

export async function save_objectives(
  plan_id: string,
  objectives: LearningObjective[]
) {
  for (let i = 0; i < objectives.length; i++) {
    const obj = objectives[i];
    await sql.query(
      `INSERT INTO dc_objectives (id, plan_id, raw_text, cognitive_verb, blooms_level, knowledge_dimension, content_topic, context, confidence, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        obj.id,
        plan_id,
        obj.raw_text,
        obj.cognitive_verb,
        obj.blooms_level,
        obj.knowledge_dimension || null,
        obj.content_topic || null,
        obj.context || null,
        obj.confidence ?? null,
        i,
      ]
    );
  }
}

export async function get_objectives_for_plan(plan_id: string) {
  const r = await sql.query(
    "SELECT * FROM dc_objectives WHERE plan_id = $1 ORDER BY sort_order",
    [plan_id]
  );
  return r.rows.map((row) => ({
    id: row.id,
    lesson_plan_id: row.plan_id,
    raw_text: row.raw_text,
    cognitive_verb: row.cognitive_verb,
    blooms_level: row.blooms_level as BloomsLevel,
    knowledge_dimension: row.knowledge_dimension as KnowledgeDimension,
    content_topic: row.content_topic,
    context: row.context,
    confidence: row.confidence,
    tasks: [] as GeneratedTask[],
  })) as LearningObjective[];
}

// ── tasks ──────────────────────────────────────────────────────────

export async function save_task(
  objective_id: string,
  task: GeneratedTask,
  generation_attempts: number,
  authenticity_passed: boolean
) {
  await sql.query(
    `INSERT INTO dc_tasks (id, objective_id, blooms_level, task_format, prompt_text, time_estimate_min, collaboration_mode, rubric_json, ej_scaffold_json, authenticity_json, reliability_notes, generation_attempts, authenticity_passed)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
     ON CONFLICT (id) DO UPDATE SET
       prompt_text = EXCLUDED.prompt_text,
       rubric_json = EXCLUDED.rubric_json,
       ej_scaffold_json = EXCLUDED.ej_scaffold_json,
       authenticity_json = EXCLUDED.authenticity_json,
       reliability_notes = EXCLUDED.reliability_notes,
       generation_attempts = EXCLUDED.generation_attempts,
       authenticity_passed = EXCLUDED.authenticity_passed`,
    [
      task.id,
      objective_id,
      task.blooms_level,
      task.task_format,
      task.prompt_text,
      task.time_estimate_minutes ?? null,
      null,
      JSON.stringify(task.rubric),
      JSON.stringify(task.ej_scaffold),
      JSON.stringify(task.authenticity_scores),
      task.reliability_notes?.map((n) => `${n.concern}: ${n.mitigation}`) ?? [],
      generation_attempts,
      authenticity_passed,
    ]
  );
}

export async function get_tasks_for_plan(plan_id: string) {
  const r = await sql.query(
    `SELECT t.* FROM dc_tasks t
     JOIN dc_objectives o ON o.id = t.objective_id
     WHERE o.plan_id = $1`,
    [plan_id]
  );
  return r.rows;
}

// ── feedback ───────────────────────────────────────────────────────

export async function save_feedback(
  user_id: string | null,
  task_id: string,
  plan_id: string,
  rating: number,
  comment: string | null
) {
  await sql.query(
    `INSERT INTO dc_feedback (user_id, task_id, plan_id, rating, comment)
     VALUES ($1, $2, $3, $4, $5)`,
    [user_id, task_id, plan_id, rating, comment]
  );
}

// ── telemetry ──────────────────────────────────────────────────────

export async function track_event(
  user_id: string | null,
  event_type: string,
  metadata: Record<string, unknown> = {}
) {
  await sql.query(
    `INSERT INTO dc_usage_events (user_id, event_type, metadata)
     VALUES ($1, $2, $3)`,
    [user_id, event_type, JSON.stringify(metadata)]
  );
}
