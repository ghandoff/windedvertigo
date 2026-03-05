/**
 * Admin API: trigger Notion CMS content sync via GitHub Actions.
 *
 * POST /api/admin/harbour-sync/notion
 *
 * Dispatches the `sync-notion.yml` workflow on the main branch, which runs
 * `scripts/fetch-notion.js`, commits updated JSON files, and triggers Vercel
 * to rebuild affected apps. After dispatch, polls once to grab the workflow
 * run URL for the admin UI.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-helpers";
import { logAccess } from "@/lib/queries/audit";

const GITHUB_REPO = "ghandoff/windedvertigo";
const WORKFLOW_FILE = "sync-notion.yml";

export async function POST(req: NextRequest) {
  const session = await requireAdmin();

  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    return NextResponse.json(
      { error: "GITHUB_TOKEN not configured" },
      { status: 500 },
    );
  }

  try {
    /* ── 1. dispatch the workflow ── */
    const dispatchRes = await fetch(
      `https://api.github.com/repos/${GITHUB_REPO}/actions/workflows/${WORKFLOW_FILE}/dispatches`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
        },
        body: JSON.stringify({ ref: "main" }),
        signal: AbortSignal.timeout(10_000),
      },
    );

    if (!dispatchRes.ok) {
      const text = await dispatchRes.text();
      return NextResponse.json(
        { error: `GitHub API error: ${dispatchRes.status} — ${text}` },
        { status: 502 },
      );
    }

    /* ── 2. brief pause, then fetch latest run to get a URL ── */
    await new Promise((r) => setTimeout(r, 2_000));

    let runUrl: string | null = null;
    let runStatus: string | null = null;

    try {
      const runsRes = await fetch(
        `https://api.github.com/repos/${GITHUB_REPO}/actions/workflows/${WORKFLOW_FILE}/runs?per_page=1`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
          },
          signal: AbortSignal.timeout(5_000),
        },
      );

      if (runsRes.ok) {
        const runsData = await runsRes.json();
        const latestRun = runsData.workflow_runs?.[0];
        runUrl = latestRun?.html_url ?? null;
        runStatus = latestRun?.status ?? null;
      }
    } catch {
      // non-fatal — the dispatch already succeeded
    }

    /* ── 3. audit log ── */
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null;
    await logAccess(
      session.userId,
      null,
      null,
      null,
      "admin_harbour_sync_notion",
      ip,
      [],
    );

    return NextResponse.json({
      success: true,
      message: "workflow dispatched",
      runUrl,
      runStatus,
    });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "failed to dispatch workflow";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
