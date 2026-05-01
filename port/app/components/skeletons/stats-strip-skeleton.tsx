import { Skeleton } from "@/components/ui/skeleton";

interface StatsStripSkeletonProps {
  /** Number of stat cards. @default 4 */
  count?: number;
}

/**
 * Skeleton placeholder for a horizontal stats strip.
 * Matches the layout of CampaignStatsStrip and the new DashboardStats.
 */
export function StatsStripSkeleton({ count = 4 }: StatsStripSkeletonProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
      {Array.from({ length: count }, (_, i) => (
        <div
          key={i}
          className="rounded-lg border border-border bg-card px-4 py-3 space-y-2"
        >
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-7 w-16" />
        </div>
      ))}
    </div>
  );
}
