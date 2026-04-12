"use server";

import { auth } from "@windedvertigo/auth";
import { revalidatePath } from "next/cache";
import {
  getOrCreateTree,
  getTreePersons,
  createTask,
  updateTaskStatus,
  deleteTask,
  generateTasksFromGaps,
  logActivity,
} from "@/lib/db/queries";
import type { TaskStatus, TaskPriority } from "@/lib/types";

async function getTreeForUser() {
  const session = await auth();
  if (!session?.user?.email) throw new Error("unauthorized");
  const tree = await getOrCreateTree(session.user.email);
  return { session, tree };
}

/** create a manual task */
export async function createTaskAction(formData: FormData) {
  const { session, tree } = await getTreeForUser();

  const title = formData.get("title") as string;
  if (!title?.trim()) throw new Error("title is required");

  const description = (formData.get("description") as string) || null;
  const personId = (formData.get("person_id") as string) || null;
  const priority = (formData.get("priority") as TaskPriority) || "medium";

  await createTask(tree.id, {
    title: title.trim(),
    description,
    personId,
    priority,
    source: "manual",
  });

  await logActivity({
    treeId: tree.id,
    actorEmail: session.user!.email!,
    action: "task_created",
    targetType: "task",
    targetName: title.trim(),
  });

  revalidatePath("/tasks");
}

/** update a task's status (for kanban moves) */
export async function updateTaskStatusAction(taskId: string, status: TaskStatus) {
  const { session, tree } = await getTreeForUser();

  await updateTaskStatus(taskId, status);

  await logActivity({
    treeId: tree.id,
    actorEmail: session.user!.email!,
    action: "task_status_changed",
    targetType: "task",
    targetId: taskId,
    details: { status },
  });

  revalidatePath("/tasks");
}

/** delete a task */
export async function deleteTaskAction(taskId: string) {
  const { session, tree } = await getTreeForUser();

  await deleteTask(taskId);

  await logActivity({
    treeId: tree.id,
    actorEmail: session.user!.email!,
    action: "task_deleted",
    targetType: "task",
    targetId: taskId,
  });

  revalidatePath("/tasks");
}

/** generate tasks from data gaps */
export async function generateGapTasksAction() {
  const { session, tree } = await getTreeForUser();

  const persons = await getTreePersons(tree.id);
  const count = await generateTasksFromGaps(tree.id, persons);

  await logActivity({
    treeId: tree.id,
    actorEmail: session.user!.email!,
    action: "gap_tasks_generated",
    targetType: "task",
    details: { count },
  });

  revalidatePath("/tasks");
  return count;
}
