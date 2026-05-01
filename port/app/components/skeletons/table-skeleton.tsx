import { Skeleton } from "@/components/ui/skeleton";

interface TableSkeletonProps {
  /** Number of table rows. @default 8 */
  rowCount?: number;
  /** Number of columns (cells per row). @default 5 */
  columnCount?: number;
}

/**
 * Skeleton placeholder that mirrors a data table layout.
 * Header row + body rows with varied cell widths for realism.
 */
export function TableSkeleton({
  rowCount = 8,
  columnCount = 5,
}: TableSkeletonProps) {
  // Stagger cell widths so the skeleton doesn't look like a uniform grid
  const widths = ["w-full", "w-3/4", "w-1/2", "w-2/3", "w-5/6"];

  return (
    <div className="rounded-lg border border-border overflow-hidden">
      {/* header */}
      <div className="flex gap-4 px-4 py-3 bg-muted/50 border-b border-border">
        {Array.from({ length: columnCount }, (_, i) => (
          <Skeleton key={i} className="h-4 w-20 flex-1 max-w-[120px]" />
        ))}
      </div>
      {/* rows */}
      {Array.from({ length: rowCount }, (_, row) => (
        <div
          key={row}
          className="flex items-center gap-4 px-4 py-3 border-b border-border last:border-b-0"
        >
          {Array.from({ length: columnCount }, (_, col) => (
            <Skeleton
              key={col}
              className={`h-4 flex-1 max-w-[160px] ${widths[(row + col) % widths.length]}`}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
