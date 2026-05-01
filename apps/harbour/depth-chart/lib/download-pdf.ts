import type { GeneratedTask, LearningObjective } from "./types";

/**
 * dynamically imports @react-pdf/renderer and generates a branded PDF for a task.
 * uses dynamic import to avoid SSR issues with the PDF library.
 */
export async function download_task_pdf(
  task: GeneratedTask,
  objective?: LearningObjective,
  plan_title?: string,
  subject?: string,
  grade_level?: string,
): Promise<void> {
  const [{ pdf }, { TaskPDF }] = await Promise.all([
    import("@react-pdf/renderer"),
    import("./pdf-template"),
  ]);

  const doc = TaskPDF({ task, objective, plan_title, subject, grade_level });
  const blob = await pdf(doc).toBlob();

  const slug = (plan_title || "task")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  const filename = `depth-chart_${slug}_${task.blooms_level}.pdf`;

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
