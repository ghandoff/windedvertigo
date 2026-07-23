/**
 * GET /api/cron/whirlpool-checkin
 *
 * Midpoint check-in for the whirlpool cycle. Runs Fridays at 17:00 UTC
 * (10:00 AM Pacific) — scheduled in lib/scheduled.ts (weekdays:[5], hours:[17]).
 *
 * Posts a digest of the current week's public commitments to #whirlpool,
 * grouped by owner with status emoji. Surfaces blocked commitments and the
 * overall completion rate so the team can course-correct before Monday.
 */

import { NextRequest } from "next/server";
import { json, error } from "@/lib/api-helpers";
import { getWhirlpoolCommitments } from "@/lib/supabase/pam";
import { postToChannelResilient } from "@/lib/slack";

const WHIRLPOOL_LEAD_EMAIL = "garrett@windedvertigo.com";

function verifyCronAuth(req: NextRequest): boolean {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  return !!token && token === process.env.CRON_SECRET;
}

/** Compute the ISO Monday date of the current week. */
function currentCycleMonday(): string {
  const today = new Date();
  const day = today.getUTCDay(); // 0=Sun … 6=Sat
  const offset = day === 0 ? -6 : 1 - day; // Mon=0
  const monday = new Date(today);
  monday.setUTCDate(today.getUTCDate() + offset);
  return monday.toISOString().slice(0, 10);
}

const STATUS_EMOJI: Record<string, string> = {
  "not-started": "⬜",
  "in-progress": "🔄",
  blocked: "🚧",
  done: "✅",
  parked: "💤",
};

export async function GET(req: NextRequest) {
  if (!verifyCronAuth(req)) return error("unauthorized", 401);

  try {
    const cycle = currentCycleMonday();
    const commitments = await getWhirlpoolCommitments(cycle);

    if (commitments.length === 0) {
      const posted = await postToChannelResilient(
        "#whirlpool",
        `*whirlpool midpoint check-in* (${cycle})\n\nno public commitments recorded for this cycle yet — ask PaM to capture them from Monday's session.`,
        [WHIRLPOOL_LEAD_EMAIL],
      );
      if (!posted) console.warn("[cron/whirlpool-checkin] Slack post failed (empty-cycle message) — see lib/slack.ts warning above for cause");
      return json({ cycle, posted, commitments: 0 });
    }

    // group by owner
    const byOwner = new Map<string, typeof commitments>();
    for (const c of commitments) {
      if (!byOwner.has(c.who)) byOwner.set(c.who, []);
      byOwner.get(c.who)!.push(c);
    }

    const done = commitments.filter((c) => c.status === "done").length;
    const blocked = commitments.filter((c) => c.status === "blocked");
    const pct = Math.round((done / commitments.length) * 100);

    const ownerLines = [...byOwner.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([who, items]) => {
        const lines = items
          .map((c) => `  ${STATUS_EMOJI[c.status] ?? "◻️"} ${c.what}`)
          .join("\n");
        return `*${who}*\n${lines}`;
      })
      .join("\n\n");

    const blockerLines =
      blocked.length > 0
        ? `\n\n🚧 *blocked:*\n${blocked.map((c) => `• ${c.who}: ${c.what}${c.blocker ? ` — ${c.blocker}` : ""}`).join("\n")}`
        : "";

    const message =
      `*whirlpool midpoint check-in* (${cycle})\n` +
      `${done}/${commitments.length} done · ${pct}% complete\n\n` +
      ownerLines +
      blockerLines +
      `\n\n_full board at port.windedvertigo.com/pam_`;

    const posted = await postToChannelResilient("#whirlpool", message, [WHIRLPOOL_LEAD_EMAIL]);
    if (!posted) console.warn("[cron/whirlpool-checkin] Slack post failed — digest was computed but never reached #whirlpool");

    return json({
      cycle,
      commitments: commitments.length,
      done,
      blocked: blocked.length,
      pct,
      posted,
    });
  } catch (err) {
    console.error("[cron/whirlpool-checkin] failed:", err);
    return error("whirlpool check-in failed", 500);
  }
}
