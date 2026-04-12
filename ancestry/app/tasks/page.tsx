import { auth } from "@windedvertigo/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getOrCreateTree, getTreeTasks, getTreePersons } from "@/lib/db/queries";
import { KanbanBoard } from "./kanban-board";
import { TasksHeader } from "./tasks-header";

export default async function TasksPage() {
  const session = await auth();
  if (!session?.user?.email) redirect("/login");

  const tree = await getOrCreateTree(session.user.email);
  const [tasks, persons] = await Promise.all([
    getTreeTasks(tree.id),
    getTreePersons(tree.id),
  ]);

  const personOptions = persons.map((p) => {
    const primary = p.names.find((n) => n.is_primary) ?? p.names[0];
    return {
      id: p.id,
      display:
        primary?.display ??
        [primary?.given_names, primary?.surname].filter(Boolean).join(" ") ??
        "unnamed",
    };
  });

  const statusCounts = {
    todo: tasks.filter((t) => t.status === "todo").length,
    in_progress: tasks.filter((t) => t.status === "in_progress").length,
    done: tasks.filter((t) => t.status === "done").length,
    dismissed: tasks.filter((t) => t.status === "dismissed").length,
  };

  return (
    <div className="min-h-screen bg-background">
      {/* header */}
      <header className="border-b border-border px-4 md:px-6 py-3">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            &larr; back to tree
          </Link>
          <span className="text-border hidden sm:inline">|</span>
          <span className="text-sm text-muted-foreground hidden sm:inline">
            {tree.name}
          </span>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-4 md:px-6 py-5 md:py-8 space-y-6">
        <TasksHeader persons={personOptions} statusCounts={statusCounts} />
        <KanbanBoard tasks={tasks} />
      </div>
    </div>
  );
}
