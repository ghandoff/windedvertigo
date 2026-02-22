/**
 * Reusable skeleton loading components for Suspense boundaries.
 *
 * Audit finding L4: add loading.tsx to key route groups.
 */

export function SkeletonCard() {
  return (
    <div
      className="rounded-lg p-6 animate-pulse"
      style={{ backgroundColor: "rgba(255, 235, 210, 0.05)" }}
    >
      <div
        className="h-5 w-2/3 rounded mb-3"
        style={{ backgroundColor: "rgba(255, 235, 210, 0.1)" }}
      />
      <div
        className="h-3 w-full rounded mb-2"
        style={{ backgroundColor: "rgba(255, 235, 210, 0.06)" }}
      />
      <div
        className="h-3 w-4/5 rounded"
        style={{ backgroundColor: "rgba(255, 235, 210, 0.06)" }}
      />
    </div>
  );
}

export function SkeletonGrid({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}

export function SkeletonPage({
  title = true,
  cards = 6,
}: {
  title?: boolean;
  cards?: number;
}) {
  return (
    <main className="max-w-5xl mx-auto px-6 py-10">
      {title && (
        <div
          className="h-8 w-48 rounded mb-8 animate-pulse"
          style={{ backgroundColor: "rgba(255, 235, 210, 0.1)" }}
        />
      )}
      <SkeletonGrid count={cards} />
    </main>
  );
}
