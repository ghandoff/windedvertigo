import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  create_plan,
  save_objectives,
  get_plans_for_user,
  count_plans_this_month,
  track_event,
} from "@/lib/queries";
import type { LearningObjective } from "@/lib/types";

// GET /api/plans — list user's plans
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const plans = await get_plans_for_user(session.user.id);
  return NextResponse.json({ plans });
}

// POST /api/plans — save a parsed plan with objectives
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { title, subject, grade_level, raw_text, source_format, objectives } =
    body as {
      title: string;
      subject: string;
      grade_level: string;
      raw_text: string;
      source_format?: string;
      objectives: LearningObjective[];
    };

  if (!raw_text?.trim() || !objectives?.length) {
    return NextResponse.json(
      { error: "raw_text and objectives are required" },
      { status: 400 }
    );
  }

  // check plan limit for non-pilot users (pilot flag not implemented yet — unlimited for now)
  const count = await count_plans_this_month(session.user.id);
  // no limit enforced for authenticated users during pilot
  // will be enforced post-launch for free tier

  const plan_id = await create_plan(
    session.user.id,
    title,
    subject,
    grade_level,
    raw_text,
    source_format || "text"
  );

  await save_objectives(plan_id, objectives);

  await track_event(session.user.id, "plan_created", {
    plan_id,
    objectives_count: objectives.length,
    blooms_levels: objectives.map((o) => o.blooms_level),
    source_format: source_format || "text",
    plans_this_month: count + 1,
  });

  return NextResponse.json({ plan_id });
}
