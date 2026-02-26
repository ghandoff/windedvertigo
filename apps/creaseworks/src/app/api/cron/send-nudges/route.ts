import { NextResponse } from "next/server";
import {
  getNudgeEligibleUsers,
  getNudgeRecommendation,
  markNudgeSent,
} from "@/lib/queries/notifications";
import { sendNudgeEmail } from "@/lib/email/send-nudge";

/**
 * POST /api/cron/send-nudges
 *
 * Called by Vercel cron (daily) or manually.
 * Protected by CRON_SECRET bearer token.
 *
 * Finds users inactive >14 days and sends them a gentle nudge
 * to re-engage with a personalized playdate recommendation.
 */
export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization");

  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  }

  try {
    const users = await getNudgeEligibleUsers();
    let sent = 0;
    let skipped = 0;
    let errors = 0;

    // Process up to 50 users per run
    for (let i = 0; i < users.length && i < 50; i++) {
      const user = users[i];

      try {
        const recommendation = await getNudgeRecommendation(user.id);

        const result = await sendNudgeEmail({
          to: user.email,
          name: user.name,
          daysInactive: user.daysInactive,
          recommendation,
        });

        if (result.success) {
          await markNudgeSent(user.id);
          sent++;
        } else {
          console.error(`[nudge] failed for ${user.email}:`, result.error);
          errors++;
        }
      } catch (err: any) {
        console.error(`[nudge] error for ${user.email}:`, err.message);
        errors++;
      }
    }

    console.log(
      `[nudge] sent=${sent} skipped=${skipped} errors=${errors} total_eligible=${users.length}`,
    );

    return NextResponse.json({
      ok: true,
      sent,
      skipped,
      errors,
      totalEligible: users.length,
    });
  } catch (err: any) {
    console.error("[nudge] cron failed:", err);
    return NextResponse.json(
      { ok: false, error: err.message ?? "unknown error" },
      { status: 500 },
    );
  }
}

/**
 * Vercel cron invokes GET by default — redirect to POST handler.
 */
export async function GET(request: Request) {
  return POST(request);
}
