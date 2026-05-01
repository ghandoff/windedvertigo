import { Skeleton } from "@/components/ui/skeleton";

interface CardGridSkeletonProps {
  /** Number of placeholder cards. @default 6 */
  cardCount?: number;
}

/**
 * Skeleton placeholder that mirrors a responsive card grid.
 * Matches the structure used by events, assets, and competitors.
 */
export function CardGridSkeleton({ cardCount = 6 }: CardGridSkeletonProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: cardCount }, (_, i) => (
        <div
          key={i}
          className="rounded-lg border border-border bg-card p-4 space-y-3"
        >
          <Skeleton className="h-5 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
          <div className="flex gap-2 pt-1">
            <Skeleton className="h-6 w-16 rounded-full" />
            <Skeleton className="h-6 w-20 rounded-full" />
          </div>
        </div>
      ))}
    </div>
  );
}
