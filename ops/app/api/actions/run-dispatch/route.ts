import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/actions/run-dispatch
 * Triggers a dispatch task manually.
 * Body: { taskId: string }
 *
 * Currently a stub — dispatch tasks run on Cowork's schedule.
 * This endpoint logs the intent and could trigger via a webhook in the future.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { taskId } = body as { taskId: string };

    if (!taskId?.trim()) {
      return NextResponse.json(
        { ok: false, error: 'taskId is required' },
        { status: 400 }
      );
    }

    // In the future, this could call a Cowork webhook to trigger the task.
    // For now, acknowledge the request.
    console.log(`[dispatch] Manual trigger requested for: ${taskId}`);

    return NextResponse.json({
      ok: true,
      message: `Dispatch queued: ${taskId}`,
      taskId,
      timestamp: new Date().toISOString(),
    });
  } catch {
    return NextResponse.json({ ok: false, error: 'Failed to dispatch' }, { status: 500 });
  }
}
