import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  get_plan,
  get_objectives_for_plan,
  get_tasks_for_plan,
  delete_plan,
} from "@/lib/queries";

// GET /api/plans/[id] — load a full plan with objectives and tasks
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const plan = await get_plan(id, session.user.id);
  if (!plan) {
    return NextResponse.json({ error: "plan not found" }, { status: 404 });
  }

  const objectives = await get_objectives_for_plan(id);
  const task_rows = await get_tasks_for_plan(id);

  // map tasks back to objectives
  const tasks_by_objective: Record<string, unknown> = {};
  for (const row of task_rows) {
    tasks_by_objective[row.objective_id] = {
      id: row.id,
      objective_id: row.objective_id,
      blooms_level: row.blooms_level,
      task_format: row.task_format,
      prompt_text: row.prompt_text,
      time_estimate_minutes: row.time_estimate_min,
      authenticity_scores: row.authenticity_json,
      rubric: row.rubric_json,
      ej_scaffold: row.ej_scaffold_json,
      reliability_notes: (row.reliability_notes || []).map((n: string) => {
        const [concern, ...rest] = n.split(": ");
        return { concern, mitigation: rest.join(": ") };
      }),
    };
  }

  return NextResponse.json({
    plan: {
      id: plan.id,
      title: plan.title,
      subject: plan.subject,
      grade_level: plan.grade_level,
      raw_text: plan.raw_text,
      source_format: plan.source_format,
      created_at: plan.created_at,
    },
    objectives,
    tasks: tasks_by_objective,
  });
}

// DELETE /api/plans/[id]
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  await delete_plan(id, session.user.id);
  return NextResponse.json({ ok: true });
}
