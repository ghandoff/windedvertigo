/**
 * GET /api/cron/weekly-digest
 *
 * Runs weekly (Monday morning) — Claude summarizes the past week's work
 * per project and posts to Slack. Covers:
 *   - What shipped (completed items)
 *   - What's in progress
 *   - What's blocked or overdue
 *   - Upcoming deadlines
 *
 * Uses Haiku for cost efficiency (~$0.01/run).
 */

import { NextRequest, NextResponse } from "next/server";
import { queryProjects } from "@/lib/notion/projects";
import { queryWorkItems } from "@/lib/notion/work-items";
import { callClaude } from "@/lib/ai/client";
import { postToSlack } from "@/lib/slack";

function verifyCronAuth(req: NextRequest): boolean {
  const authHeader = req.headers.get("authorization");
  if (!authHeader) return false;
  return authHeader.replace("Bearer ", "") === process.env.CRON_SECRET;
}

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(0, 0, 0, 0);
  return d;
}

export async function GET(req: NextRequest) {
  if (!verifyCronAuth(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const [{ data: projects }, { data: workItems }] = await Promise.all([
    queryProjects(undefined, { pageSize: 50 }),
    queryWorkItems({ archive: false }, { pageSize: 300 }),
  ]);

  const oneWeekAgo = daysAgo(7);

  // Build per-project summaries from raw data
  const projectSummaries: string[] = [];

  for (const project of projects) {
    const items = workItems.filter((wi) => wi.projectIds.includes(project.id));
    if (items.length === 0) continue;

    // Items completed in the last 7 days (by last edited time as proxy)
    const recentlyCompleted = items.filter(
      (wi) =>
        (wi.status === "complete" || wi.status === "cancelled") &&
        new Date(wi.lastEditedTime) >= oneWeekAgo,
    );

    const inProgress = items.filter(
      (wi) => wi.status === "in progress" || wi.status === "internal review" || wi.status === "client review",
    );

    const blocked = items.filter((wi) => wi.status === "suspended");

    // Skip projects with no recent activity
    if (recentlyCompleted.length === 0 && inProgress.length === 0 && blocked.length === 0) {
      continue;
    }

    const lines: string[] = [`## ${project.project} (${project.type ?? "studio"})`];

    if (recentlyCompleted.length > 0) {
      lines.push(`Shipped: ${recentlyCompleted.map((wi) => wi.task).join(", ")}`);
    }
    if (inProgress.length > 0) {
      lines.push(`In progress: ${inProgress.map((wi) => wi.task).join(", ")}`);
    }
    if (blocked.length > 0) {
      lines.push(`Blocked: ${blocked.map((wi) => wi.task).join(", ")}`);
    }

    // Upcoming deadline
    const endDate = project.timeline?.end;
    if (endDate) {
      const daysLeft = Math.ceil(
        (new Date(endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
      );
      if (daysLeft > 0 && daysLeft <= 30) {
        lines.push(`Deadline: ${endDate} (${daysLeft} days)`);
      }
    }

    projectSummaries.push(lines.join("\n"));
  }

  if (projectSummaries.length === 0) {
    return NextResponse.json({ message: "no active projects to summarize" });
  }

  // Ask Claude to write a concise Slack-formatted digest
  const result = await callClaude({
    feature: "weekly-digest",
    system: `You are a project status reporter for Winded Vertigo, a learning design collective.
Write a concise weekly status digest in Slack mrkdwn format. Use *bold* for project names.
Group by: shipped, in progress, blocked/at risk. Keep each line to one sentence.
End with 1-2 sentence outlook for the coming week based on what's in progress.
Be direct and factual. No fluff. Use lowercase style.`,
    userMessage: `Summarize this week's project status:\n\n${projectSummaries.join("\n\n")}`,
    userId: "system-cron",
    maxTokens: 1024,
    temperature: 0.3,
  });

  const message = `📊 *weekly status digest*\n\n${result.text}`;
  await postToSlack(message);

  return NextResponse.json({
    message: "digest posted",
    projectsSummarized: projectSummaries.length,
    costUsd: result.costUsd,
  });
}
