/**
 * Admin API: force-redeploy harbour ecosystem Vercel apps.
 *
 * POST /api/admin/harbour-sync/redeploy
 * Body: { apps: string[] }
 *
 * Fetches the latest production deployment for each selected app, then
 * triggers a fresh production deployment from that snapshot. Useful after
 * environment variable changes or when a rebuild is needed without a
 * content change.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-helpers";
import { logAccess } from "@/lib/queries/audit";
import { parseJsonBody } from "@/lib/api-helpers";

/* ── Vercel project IDs (mirrors reservoir-status.ts) ── */
const VERCEL_APPS: Record<string, string> = {
  site: "prj_k02f1LutCsQLZEDIyM2xYJ1PGPCx",
  harbour: "prj_KqjKxyhlGTublMolccOkvLFBZ8Xn",
  creaseworks: "prj_EoDpRvw1kdAqcGVrcaYclfWFeX7b",
  "deep-deck": "prj_Z2zpJXnsOrVp5hyoJ89ERuQHmOru",
  "vertigo-vault": "prj_KHsZ60sQpj3ipSB5lzy9CGVAUYaW",
  "nordic-sqr-rct": "prj_laAl3qm5w20CrtIjO2klc9dj180z",
};

const TEAM_ID = "team_wrpRda7ZzXdu7nKcEVVXY3th";

interface RedeployResult {
  app: string;
  success: boolean;
  error?: string;
  url?: string;
}

export async function POST(req: NextRequest) {
  const session = await requireAdmin();
  const parsed = await parseJsonBody(req);
  if (parsed instanceof NextResponse) return parsed;

  const { apps } = parsed as { apps?: string[] };

  if (!apps || !Array.isArray(apps) || apps.length === 0) {
    return NextResponse.json(
      { error: "apps array is required" },
      { status: 400 },
    );
  }

  const validApps = apps.filter((a) => a in VERCEL_APPS);
  if (validApps.length === 0) {
    return NextResponse.json(
      { error: "no valid app names provided" },
      { status: 400 },
    );
  }

  const token = process.env.VERCEL_ACCESS_TOKEN;
  if (!token) {
    return NextResponse.json(
      { error: "VERCEL_ACCESS_TOKEN not configured" },
      { status: 500 },
    );
  }

  /* ── redeploy each selected app in parallel ── */
  const results: RedeployResult[] = await Promise.all(
    validApps.map(async (appName): Promise<RedeployResult> => {
      const projectId = VERCEL_APPS[appName];
      try {
        // 1. Get latest production deployment
        const listRes = await fetch(
          `https://api.vercel.com/v6/deployments?projectId=${projectId}&teamId=${TEAM_ID}&limit=1&target=production`,
          {
            headers: { Authorization: `Bearer ${token}` },
            signal: AbortSignal.timeout(5_000),
          },
        );
        if (!listRes.ok) {
          throw new Error(`list deployments failed: ${listRes.status}`);
        }

        const listData = await listRes.json();
        const latestDeploy = listData.deployments?.[0];
        if (!latestDeploy) {
          throw new Error("no production deployment found");
        }

        // 2. Create a new deployment from that snapshot
        const redeployRes = await fetch(
          `https://api.vercel.com/v13/deployments?teamId=${TEAM_ID}`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              deploymentId: latestDeploy.uid,
              name: appName,
              target: "production",
            }),
            signal: AbortSignal.timeout(10_000),
          },
        );

        if (!redeployRes.ok) {
          const text = await redeployRes.text();
          throw new Error(`redeploy failed: ${redeployRes.status} — ${text}`);
        }

        const redeployData = await redeployRes.json();
        return { app: appName, success: true, url: redeployData.url };
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : "unknown error";
        return { app: appName, success: false, error: message };
      }
    }),
  );

  /* ── audit log ── */
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null;
  await logAccess(
    session.userId,
    null,
    null,
    null,
    "admin_harbour_force_redeploy",
    ip,
    [],
    { apps: validApps.join(",") },
  );

  return NextResponse.json({ results });
}
