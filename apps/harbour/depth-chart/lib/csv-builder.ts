/**
 * CSV rubric matrix exporter for depth.chart.
 *
 * generates a gradebook-compatible CSV with:
 * - rows = rubric criteria
 * - columns = performance levels (beginning → exemplary)
 * - cells = behavioral anchors
 *
 * compatible with Canvas rubric CSV import, Google Sheets, Excel.
 */

import type { GeneratedTask } from "./types";
import { TASK_FORMATS } from "./task-formats";

const LEVEL_ORDER = ["beginning", "developing", "proficient", "exemplary"] as const;

function csv_cell(value: string): string {
  // wrap in quotes and escape internal quotes
  const escaped = value.replace(/"/g, '""');
  return `"${escaped}"`;
}

/**
 * build a CSV rubric matrix for a single task.
 * includes a metadata header section + the criteria table.
 */
export function build_rubric_csv(
  task: GeneratedTask,
  meta?: { plan_title?: string; subject?: string; grade_level?: string }
): string {
  const format = TASK_FORMATS[task.task_format];
  const rows: string[] = [];

  // metadata section
  rows.push(`${csv_cell("depth.chart rubric export")}`);
  if (meta?.plan_title) rows.push(`${csv_cell("plan")},${csv_cell(meta.plan_title)}`);
  if (meta?.subject) rows.push(`${csv_cell("subject")},${csv_cell(meta.subject)}`);
  if (meta?.grade_level) rows.push(`${csv_cell("grade level")},${csv_cell(meta.grade_level)}`);
  rows.push(`${csv_cell("format")},${csv_cell(format?.label || task.task_format)}`);
  rows.push(`${csv_cell("bloom's level")},${csv_cell(task.blooms_level)}`);
  rows.push(`${csv_cell("time estimate")},${csv_cell(`~${task.time_estimate_minutes} minutes`)}`);
  rows.push(""); // blank row separator

  // rubric header
  rows.push(
    [
      csv_cell("criterion"),
      csv_cell("weight"),
      ...LEVEL_ORDER.map((l) => csv_cell(`${l} (${LEVEL_ORDER.indexOf(l) + 1})`)),
      csv_cell("bloom's alignment"),
      csv_cell("authenticity dimension"),
    ].join(",")
  );

  // rubric rows
  for (const criterion of task.rubric.criteria) {
    const cells = [
      csv_cell(criterion.name),
      csv_cell(`${(criterion.weight * 100).toFixed(0)}%`),
    ];

    for (const label of LEVEL_ORDER) {
      const level = criterion.levels.find((l) => l.label === label);
      cells.push(csv_cell(level?.behavioral_anchor || "—"));
    }

    cells.push(csv_cell(criterion.blooms_alignment));
    cells.push(csv_cell(criterion.authenticity_dimension));

    rows.push(cells.join(","));
  }

  // reliability info
  rows.push("");
  rows.push(`${csv_cell("reliability")}`);
  rows.push(
    `${csv_cell("recommended raters")},${csv_cell(String(task.rubric.reliability_estimate.recommended_raters))}`
  );
  rows.push(
    `${csv_cell("expected ICC range")},${csv_cell(
      `${task.rubric.reliability_estimate.expected_icc_range[0].toFixed(2)}–${task.rubric.reliability_estimate.expected_icc_range[1].toFixed(2)}`
    )}`
  );
  if (task.rubric.reliability_estimate.validity_tradeoff) {
    rows.push(
      `${csv_cell("validity tradeoff")},${csv_cell(task.rubric.reliability_estimate.validity_tradeoff)}`
    );
  }

  return rows.join("\n");
}

/**
 * build a combined CSV for all tasks in a plan.
 * each task gets a section separated by blank rows.
 */
export function build_plan_rubrics_csv(
  tasks: { task: GeneratedTask; objective_text?: string }[],
  meta?: { plan_title?: string; subject?: string; grade_level?: string }
): string {
  const sections: string[] = [];

  // plan header
  sections.push(`${csv_cell("depth.chart — rubric matrix export")}`);
  if (meta?.plan_title) sections.push(`${csv_cell("plan")},${csv_cell(meta.plan_title)}`);
  if (meta?.subject) sections.push(`${csv_cell("subject")},${csv_cell(meta.subject)}`);
  if (meta?.grade_level) sections.push(`${csv_cell("grade level")},${csv_cell(meta.grade_level)}`);
  sections.push(`${csv_cell("exported")},${csv_cell(new Date().toISOString())}`);
  sections.push(`${csv_cell("tasks")},${csv_cell(String(tasks.length))}`);
  sections.push("");

  for (let i = 0; i < tasks.length; i++) {
    const { task, objective_text } = tasks[i];
    const format = TASK_FORMATS[task.task_format];

    sections.push(`${csv_cell(`task ${i + 1}: ${format?.label || task.task_format}`)}`);
    if (objective_text) sections.push(`${csv_cell("objective")},${csv_cell(objective_text)}`);
    sections.push(`${csv_cell("bloom's level")},${csv_cell(task.blooms_level)}`);
    sections.push(`${csv_cell("time")},${csv_cell(`~${task.time_estimate_minutes} min`)}`);
    sections.push("");

    // rubric header
    sections.push(
      [
        csv_cell("criterion"),
        csv_cell("weight"),
        ...LEVEL_ORDER.map((l) => csv_cell(`${l} (${LEVEL_ORDER.indexOf(l) + 1})`)),
      ].join(",")
    );

    for (const criterion of task.rubric.criteria) {
      const cells = [
        csv_cell(criterion.name),
        csv_cell(`${(criterion.weight * 100).toFixed(0)}%`),
      ];
      for (const label of LEVEL_ORDER) {
        const level = criterion.levels.find((l) => l.label === label);
        cells.push(csv_cell(level?.behavioral_anchor || "—"));
      }
      sections.push(cells.join(","));
    }

    sections.push(""); // blank row between tasks
  }

  return sections.join("\n");
}
