import { Suspense } from "react";
import { queryWorkItems } from "@/lib/notion/work-items";
import { WorkItemRow } from "./components/work-item-row";

export const revalidate = 120;

async function ActiveWorkItems() {
  const { data: items } = await queryWorkItems(
    { archive: false },
    { pageSize: 30 },
  );

  // Show only active items (not icebox/complete/cancelled)
  const activeStatuses = new Set(["in queue", "in progress", "internal review", "client review", "suspended", "needs documentation"]);
  const active = items.filter((i) => activeStatuses.has(i.status));

  if (active.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p className="text-sm">no active work items</p>
      </div>
    );
  }

  // Group by status
  const inProgress = active.filter((i) => i.status === "in progress");
  const todo = active.filter((i) => i.status === "in queue");
  const review = active.filter((i) => ["internal review", "client review", "suspended", "needs documentation"].includes(i.status));

  function renderItem(item: (typeof active)[0]) {
    return (
      <WorkItemRow
        key={item.id}
        id={item.id}
        task={item.task}
        status={item.status}
        priority={item.priority}
        taskType={item.taskType}
        dueDate={item.dueDate?.start ?? null}
        estimateHours={item.estimateHours}
      />
    );
  }

  return (
    <div className="space-y-4">
      {inProgress.length > 0 && (
        <div>
          <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">in progress ({inProgress.length})</h2>
          {inProgress.map(renderItem)}
        </div>
      )}
      {review.length > 0 && (
        <div>
          <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">in review ({review.length})</h2>
          {review.map(renderItem)}
        </div>
      )}
      {todo.length > 0 && (
        <div>
          <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">to do ({todo.length})</h2>
          {todo.map(renderItem)}
        </div>
      )}
    </div>
  );
}

export default function MobileWorkPage() {
  return (
    <>
      <h1 className="text-lg font-semibold mb-4">work</h1>
      <Suspense fallback={<div className="text-center py-8 text-muted-foreground text-sm">loading...</div>}>
        <ActiveWorkItems />
      </Suspense>
    </>
  );
}
