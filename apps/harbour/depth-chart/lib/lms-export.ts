/**
 * LMS export orchestrator for depth.chart.
 *
 * provides three export functions:
 * 1. download_qti_package — single task as QTI 2.1 content package (.zip)
 * 2. download_qti_plan — all tasks in a plan as QTI 2.1 content package (.zip)
 * 3. download_rubric_csv — rubric matrix as CSV
 *
 * all functions use dynamic imports to keep JSZip out of the initial bundle.
 */

import type { GeneratedTask, LearningObjective } from "./types";
import { build_qti_item, build_manifest } from "./qti-builder";
import { build_rubric_csv, build_plan_rubrics_csv } from "./csv-builder";
import { TASK_FORMATS } from "./task-formats";

// ── helpers ──────────────────────────────────────────────

function trigger_download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function slug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

// ── single task QTI package ──────────────────────────────

export async function download_qti_package(
  task: GeneratedTask,
  objective?: LearningObjective,
  plan_title?: string,
  subject?: string,
  grade_level?: string,
): Promise<void> {
  const JSZip = (await import("jszip")).default;
  const zip = new JSZip();

  const item_filename = `items/${task.id || "item_001"}.xml`;
  const format = TASK_FORMATS[task.task_format];
  const title = `${format?.label || task.task_format} — ${task.blooms_level}`;

  // add QTI item
  const item_xml = build_qti_item(task, objective, { plan_title, subject, grade_level });
  zip.file(item_filename, item_xml);

  // add manifest
  const manifest = build_manifest(
    [{ id: task.id || "item_001", filename: item_filename, title }],
    plan_title || "depth.chart assessment"
  );
  zip.file("imsmanifest.xml", manifest);

  // generate and download
  const blob = await zip.generateAsync({ type: "blob" });
  const filename = `depth-chart_${slug(plan_title || "task")}_${task.blooms_level}_qti.zip`;
  trigger_download(blob, filename);
}

// ── full plan QTI package ────────────────────────────────

export async function download_qti_plan(
  tasks: Record<string, GeneratedTask>,
  objectives: LearningObjective[],
  plan_title?: string,
  subject?: string,
  grade_level?: string,
): Promise<void> {
  const JSZip = (await import("jszip")).default;
  const zip = new JSZip();

  const manifest_items: { id: string; filename: string; title: string }[] = [];

  for (const obj of objectives) {
    const task = tasks[obj.id];
    if (!task) continue;

    const item_id = task.id || `item_${obj.id}`;
    const item_filename = `items/${item_id}.xml`;
    const format = TASK_FORMATS[task.task_format];
    const title = `${format?.label || task.task_format} — ${task.blooms_level}`;

    const item_xml = build_qti_item(task, obj, { plan_title, subject, grade_level });
    zip.file(item_filename, item_xml);

    manifest_items.push({ id: item_id, filename: item_filename, title });
  }

  if (manifest_items.length === 0) return;

  const manifest = build_manifest(
    manifest_items,
    plan_title || "depth.chart assessment plan"
  );
  zip.file("imsmanifest.xml", manifest);

  const blob = await zip.generateAsync({ type: "blob" });
  const filename = `depth-chart_${slug(plan_title || "plan")}_qti.zip`;
  trigger_download(blob, filename);
}

// ── CSV exports ──────────────────────────────────────────

export function download_rubric_csv(
  task: GeneratedTask,
  plan_title?: string,
  subject?: string,
  grade_level?: string,
): void {
  const csv = build_rubric_csv(task, { plan_title, subject, grade_level });
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const filename = `depth-chart_${slug(plan_title || "rubric")}_${task.blooms_level}.csv`;
  trigger_download(blob, filename);
}

export function download_plan_rubrics_csv(
  tasks: Record<string, GeneratedTask>,
  objectives: LearningObjective[],
  plan_title?: string,
  subject?: string,
  grade_level?: string,
): void {
  const task_list = objectives
    .filter((obj) => tasks[obj.id])
    .map((obj) => ({
      task: tasks[obj.id],
      objective_text: obj.raw_text,
    }));

  if (task_list.length === 0) return;

  const csv = build_plan_rubrics_csv(task_list, { plan_title, subject, grade_level });
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const filename = `depth-chart_${slug(plan_title || "rubrics")}_all.csv`;
  trigger_download(blob, filename);
}
