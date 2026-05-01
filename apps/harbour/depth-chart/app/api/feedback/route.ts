import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { save_feedback, track_event } from "@/lib/queries";

export async function POST(request: Request) {
  const session = await auth();
  const user_id = session?.user?.id ?? null;

  const body = await request.json();
  const { task_id, plan_id, rating, comment } = body as {
    task_id: string;
    plan_id: string;
    rating: number;
    comment?: string;
  };

  if (!task_id || !plan_id || !rating || rating < 1 || rating > 5) {
    return NextResponse.json(
      { error: "task_id, plan_id, and rating (1-5) are required" },
      { status: 400 }
    );
  }

  await save_feedback(user_id, task_id, plan_id, rating, comment || null);

  await track_event(user_id, "feedback_submitted", {
    task_id,
    plan_id,
    rating,
    has_comment: !!comment,
  });

  return NextResponse.json({ ok: true });
}
