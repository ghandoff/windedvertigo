/**
 * /api/admin/social-metrics
 *
 * Manual-entry endpoint for the SocialMetricsForm on the strategy page.
 * Auth gate: signed-in user with @windedvertigo.com email. The form is
 * the only call-site today.
 *
 * POST  — insert a new metric row (latest-row-wins read pattern in
 *         lib/marketing/social-metrics.ts).
 * GET   — list latest entries per metric_key for a given ?platform=
 *         (used by the form to prefill the "previous value" hint).
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { json, error as errorJson } from "@/lib/api-helpers";
import {
  insertSocialMetric,
  getLatestSocialMetrics,
  SOCIAL_PLATFORMS,
  type SocialPlatform,
} from "@/lib/marketing/social-metrics";

// ── auth helper ─────────────────────────────────────────────────────

async function authoriseWvUser() {
  const session = await auth();
  if (!session?.user) {
    return { ok: false as const, status: 401, message: "unauthorized" };
  }
  const email = session.user.email ?? "";
  if (!email.endsWith("@windedvertigo.com")) {
    return {
      ok: false as const,
      status: 403,
      message: "only winded.vertigo team members can update social metrics",
    };
  }
  return {
    ok: true as const,
    email,
    name: session.user.name ?? null,
  };
}

// ── POST ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const auth = await authoriseWvUser();
  if (!auth.ok) return errorJson(auth.message, auth.status);

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return errorJson("invalid json body", 400);
  }

  const { platform, metricKey, value, periodStart, periodEnd, note } =
    body as Record<string, unknown>;

  if (typeof platform !== "string" || !SOCIAL_PLATFORMS.includes(platform as SocialPlatform)) {
    return errorJson(`invalid platform`, 400);
  }
  if (typeof metricKey !== "string" || !metricKey) {
    return errorJson(`metricKey is required`, 400);
  }
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return errorJson(`value must be a number`, 400);
  }

  try {
    const { id } = await insertSocialMetric({
      platform: platform as SocialPlatform,
      metricKey,
      value: Math.round(value),
      periodStart: typeof periodStart === "string" ? periodStart : undefined,
      periodEnd: typeof periodEnd === "string" ? periodEnd : undefined,
      enteredByEmail: auth.email,
      enteredByName: auth.name,
      note: typeof note === "string" ? note : null,
    });
    return json({ ok: true, id });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "insert failed";
    return errorJson(msg, 400);
  }
}

// ── GET ─────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const authResult = await authoriseWvUser();
  if (!authResult.ok) return errorJson(authResult.message, authResult.status);

  const { searchParams } = new URL(req.url);
  const platform = searchParams.get("platform");

  if (!platform || !SOCIAL_PLATFORMS.includes(platform as SocialPlatform)) {
    return errorJson(`platform query param required`, 400);
  }

  const latest = await getLatestSocialMetrics(platform as SocialPlatform);
  return json({ platform, latest });
}
