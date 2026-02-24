import { NextResponse } from "next/server";
import {
  getDigestEligibleUsers,
  getDigestContent,
  markDigestSent,
} from "@/lib/queries/notifications";
import { sendDigestEmail } from "@/lib/email/send-digest";
import { buildUnsubscribeUrl } from "@/lib/email/unsubscribe-token";

/**
 * POST /api/cron/send-digests
 *
 * Called by Vercel cron (Mondays 09:00 UTC) or manually.
 * Protected by CRON_SECRET bearer token.
 *
 * Session 21: weekly digest email system.
 */
export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization");

  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  }

  try {
    const users = await getDigestEligibleUsers();
    let sent = 0;
    let skipped = 0;
    let errors = 0;

    // Process in batches of 10 to avoid overwhelming Resend
    for (let i = 0; i < users.length && i < 50; i++) {
      const user = users[i];

      try {
        const content = await getDigestContent(user.id, user.lastDigestAt);

        if (content.isEmpty) {
          skipped++;
          // Still mark sent so we don't retry next time
          await markDigestSent(user.id);
          continue;
        }

        const unsubscribeUrl = buildUnsubscribeUrl(user.id);

        const result = await sendDigestEmail({
          to: user.email,
          name: user.name,
          content,
          unsubscribeUrl,
        });

        if (result.success) {
          await markDigestSent(user.id);
          sent++;
        } else {
          console.error(`[digest] failed for ${user.email}:`, result.error);
          errors++;
        }
      } catch (err: any) {
        console.error(`[digest] error for ${user.email}:`, err.message);
        errors++;
      }
    }

    console.log(`[digest] sent=${sent} skipped=${skipped} errors=${errors} total_eligible=${users.length}`);

    return NextResponse.json({
      ok: true,
      sent,
      skipped,
      errors,
      totalEligible: users.length,
    });
  } catch (err: any) {
    console.error("[digest] cron failed:", err);
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
