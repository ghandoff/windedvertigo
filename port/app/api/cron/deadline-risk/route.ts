/**
 * GET /api/cron/deadline-risk
 *
 * Runs daily — checks contract projects for deadline risk.
 * Math, not ML: sums remaining task estimates, compares to available hours
 * before deadline, and flags projects at risk. Posts alerts to Slack.
 *
 * Risk calculation:
 *   remaining_hours = sum of estimate_hours for non-complete work items
 *   available_days  = business days until project end date
 *   available_hours = available_days × 6 (assumes 6 productive hrs/day)
 *   risk_ratio      = remaining_hours / available_hours
 *   at_risk         = risk_ratio > 0.9 (90%+ capacity needed)
 *   over_capacity   = risk_ratio > 1.0 (more work than time)
 */

import { NextRequest, NextResponse } from "next/server";
import { queryProjects } from "@/lib/notion/projects";
import { queryWorkItems } from "@/lib/notion/work-items";
import { postToSlack } from "@/lib/slack";

function verifyCronAuth(req: NextRequest): boolean {
  const authHeader = req.headers.get("authorization");
  if (!authHeader) return false;
  return authHeader.replace("Bearer ", "") === process.env.CRON_SECRET;
}

function businessDaysBetween(start: Date, end: Date): number {
  let count = 0;
  const current = new Date(start);
  while (current <= end) {
    const day = current.getDay();
    if (day !== 0 && day !== 6) count++;
    current.setDate(current.getDate() + 1);
  }
  return count;
}

const PRODUCTIVE_HOURS_PER_DAY = 6;

export async function GET(req: NextRequest) {
  if (!verifyCronAuth(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // Fetch contract projects with end dates and budget
  const { data: projects } = await queryProjects(
    { type: "contract" },
    { pageSize: 50 },
  );

  // Fetch all non-archived, non-complete work items
  const { data: workItems } = await queryWorkItems(
    { archive: false },
    { pageSize: 200 },
  );

  const now = new Date();
  const alerts: string[] = [];

  for (const project of projects) {
    // Need an end date to calculate risk
    const endDateStr = project.timeline?.end;
    if (!endDateStr) continue;

    const endDate = new Date(endDateStr);
    if (endDate < now) continue; // already past deadline

    // Get remaining work items for this project
    const completedStatuses = new Set(["complete", "cancelled"]);
    const projectItems = workItems.filter(
      (wi) =>
        wi.projectIds.includes(project.id) &&
        !completedStatuses.has(wi.status),
    );

    if (projectItems.length === 0) continue;

    // Sum remaining estimated hours
    const remainingHours = projectItems.reduce(
      (sum, wi) => sum + (wi.estimateHours ?? 0),
      0,
    );

    if (remainingHours === 0) continue; // no estimates to check

    // Calculate available capacity
    const availableDays = businessDaysBetween(now, endDate);
    const availableHours = availableDays * PRODUCTIVE_HOURS_PER_DAY;

    if (availableHours === 0) {
      alerts.push(
        `🔴 *${project.project}*: deadline is today/tomorrow with ${remainingHours.toFixed(1)}h remaining work (${projectItems.length} tasks)`,
      );
      continue;
    }

    const riskRatio = remainingHours / availableHours;

    if (riskRatio > 1.0) {
      alerts.push(
        `🔴 *${project.project}*: over capacity — ${remainingHours.toFixed(1)}h remaining, only ${availableHours}h available (${availableDays} days). ${projectItems.length} tasks open.`,
      );
    } else if (riskRatio > 0.9) {
      alerts.push(
        `🟡 *${project.project}*: at risk — ${remainingHours.toFixed(1)}h remaining, ${availableHours}h available (${Math.round(riskRatio * 100)}% capacity). ${projectItems.length} tasks open.`,
      );
    }

    // Also flag projects with budget burn > 90%
    if (project.budgetHours && project.budgetHours > 0) {
      const completedItems = workItems.filter(
        (wi) =>
          wi.projectIds.includes(project.id) &&
          completedStatuses.has(wi.status),
      );
      const burnedEstimate = completedItems.reduce(
        (sum, wi) => sum + (wi.estimateHours ?? 0),
        0,
      );
      const burnPct = burnedEstimate / project.budgetHours;
      if (burnPct >= 0.9 && !alerts.some((a) => a.includes(project.project))) {
        alerts.push(
          `🟡 *${project.project}*: budget ~${Math.round(burnPct * 100)}% burned (${burnedEstimate.toFixed(1)}h / ${project.budgetHours}h budget)`,
        );
      }
    }
  }

  if (alerts.length > 0) {
    const message = `📋 *Deadline Risk Report*\n\n${alerts.join("\n\n")}`;
    await postToSlack(message);
  }

  return NextResponse.json({
    message: alerts.length > 0
      ? `${alerts.length} project(s) at risk`
      : "all projects on track",
    alerts,
    projectsChecked: projects.length,
  });
}
