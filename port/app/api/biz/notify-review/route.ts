/**
 * POST /api/biz/notify-review — Biz pings the reviewers (Garrett + Maria by
 * default) via Slack DM that a bid is review-ready, so they can get eyes on it
 * in time. Logs the hand-off to biz_decisions. Auth: Bearer CMO_API_TOKEN.
 *
 * Body: { rfp_id, name, summary, due_date?, due_local?, review_url?, reviewers? }
 */

import { NextRequest } from "next/server";
import { json, error } from "@/lib/api-helpers";
import { sendDmByEmail } from "@/lib/slack";
import { createBizDecision } from "@/lib/biz-data";

const DEFAULT_REVIEWERS = (process.env.BIZ_REVIEW_EMAILS ?? "garrett@windedvertigo.com,maria@windedvertigo.com")
  .split(",").map((e) => e.trim()).filter(Boolean);

function verifyAuth(req: NextRequest): boolean {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  return !!token && token === process.env.CMO_API_TOKEN;
}

export async function POST(req: NextRequest) {
  if (!verifyAuth(req)) return error("unauthorized", 401);

  const body = await req.json().catch(() => null);
  if (!body?.name) return error("name is required");
  if (!body?.summary) return error("summary is required");

  const reviewers: string[] = Array.isArray(body.reviewers) && body.reviewers.length ? body.reviewers : DEFAULT_REVIEWERS;

  const dueLine = body.due_local
    ? `\n*due:* ${body.due_local}`
    : body.due_date
      ? `\n*due:* ${body.due_date}`
      : "";
  const linkLine = body.review_url ? `\n<${body.review_url}|review the bundle →>` : "";
  const text =
    `📋 *Biz — bid ready for your review:* ${body.name}\n${body.summary}${dueLine}${linkLine}\n\n_please get eyes on this while there's runway._`;

  const sent: string[] = [];
  const failed: string[] = [];
  for (const email of reviewers) {
    const ok = await sendDmByEmail(email, text).catch(() => false);
    (ok ? sent : failed).push(email);
  }

  // log the hand-off (best-effort)
  await createBizDecision({
    decision: `requested review of "${body.name}"`,
    context: `DM'd ${sent.join(", ") || "no one"}${failed.length ? ` (failed: ${failed.join(", ")})` : ""}`,
    category: "review-handoff",
    rfp_id: body.rfp_id ?? undefined,
    logged_by: "biz",
  }).catch(() => {});

  return json({ sent, failed, reviewers }, sent.length ? 200 : 207);
}
