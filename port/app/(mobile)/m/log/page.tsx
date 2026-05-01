import { Suspense } from "react";
import { queryWorkItems } from "@/lib/notion/work-items";
import { MobileTimeEntry } from "@/app/components/mobile-time-entry";
import { QuickLogForm } from "@/app/components/quick-log-form";

export const revalidate = 120;

async function TimeEntryLoader() {
  // Fetch active work items for the task picker
  const { data: items } = await queryWorkItems(
    { archive: false },
    { pageSize: 30 },
  );

  const activeStatuses = new Set(["in queue", "in progress", "internal review", "client review"]);
  const recentTasks = items
    .filter((i) => activeStatuses.has(i.status))
    .map((i) => ({ id: i.id, name: i.task }));

  return <MobileTimeEntry recentTasks={recentTasks} />;
}

export default function MobileLogPage() {
  return (
    <>
      <h1 className="text-lg font-semibold mb-4">log time</h1>
      <Suspense fallback={<div className="text-center py-8 text-muted-foreground text-sm">loading...</div>}>
        <TimeEntryLoader />
      </Suspense>

      {/* Activity logging below */}
      <div className="mt-8 pt-6 border-t border-border">
        <h2 className="text-sm font-medium text-muted-foreground mb-3">log activity</h2>
        <QuickLogForm />
      </div>
    </>
  );
}
