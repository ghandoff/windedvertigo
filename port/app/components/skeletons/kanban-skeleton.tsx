import { Skeleton } from "@/components/ui/skeleton";

interface KanbanSkeletonProps {
  /** Number of Kanban columns to render. @default 4 */
  columnCount?: number;
  /** Cards per column. @default 3 */
  cardCount?: number;
}

/**
 * Skeleton placeholder that mirrors a Kanban board layout.
 * Matches the structure of DraggableKanban / PipelineBoard.
 */
export function KanbanSkeleton({
  columnCount = 4,
  cardCount = 3,
}: KanbanSkeletonProps) {
  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {Array.from({ length: columnCount }, (_, col) => (
        <div key={col} className="flex-shrink-0 w-72">
          <Skeleton className="h-8 w-32 mb-3" />
          <div className="space-y-3">
            {Array.from({ length: cardCount }, (_, card) => (
              <Skeleton key={card} className="h-24 w-full rounded-lg" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
