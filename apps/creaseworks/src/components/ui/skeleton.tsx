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

/** Playbook-shaped skeleton: pills + progress + grid + reflections */
export function SkeletonPlaybook() {
  return (
    <main className="min-h-screen px-6 pt-16 pb-24 sm:pb-16 max-w-4xl mx-auto">
      <div
        className="h-8 w-40 rounded mb-1 animate-pulse"
        style={{ backgroundColor: "rgba(255, 235, 210, 0.1)" }}
      />
      <div
        className="h-4 w-72 rounded mb-8 animate-pulse"
        style={{ backgroundColor: "rgba(255, 235, 210, 0.06)" }}
      />
      {/* stat pills */}
      <div className="flex gap-2 mb-6">
        {[80, 60, 72, 96].map((w, i) => (
          <div
            key={i}
            className="h-6 rounded-full animate-pulse"
            style={{
              width: w,
              backgroundColor: "rgba(255, 235, 210, 0.08)",
            }}
          />
        ))}
      </div>
      {/* credit bar */}
      <div
        className="h-10 rounded-lg mb-6 animate-pulse"
        style={{ backgroundColor: "rgba(255, 235, 210, 0.05)" }}
      />
      {/* collections grid */}
      <div
        className="h-5 w-28 rounded mb-3 animate-pulse"
        style={{ backgroundColor: "rgba(255, 235, 210, 0.1)" }}
      />
      <SkeletonGrid count={6} />
    </main>
  );
}

/** Profile-shaped skeleton: stats + pack cards + recommendations */
export function SkeletonProfile() {
  return (
    <main className="min-h-screen px-6 pt-16 pb-24 sm:pb-16 max-w-4xl mx-auto">
      <div
        className="h-8 w-32 rounded mb-6 animate-pulse"
        style={{ backgroundColor: "rgba(255, 235, 210, 0.1)" }}
      />
      {/* stats row */}
      <div className="flex gap-4 mb-8">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="flex-1 h-20 rounded-lg animate-pulse"
            style={{ backgroundColor: "rgba(255, 235, 210, 0.05)" }}
          />
        ))}
      </div>
      {/* pack cards */}
      <div
        className="h-5 w-36 rounded mb-3 animate-pulse"
        style={{ backgroundColor: "rgba(255, 235, 210, 0.1)" }}
      />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
        {[1, 2].map((i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
      {/* recommendations */}
      <div
        className="h-5 w-44 rounded mb-3 animate-pulse"
        style={{ backgroundColor: "rgba(255, 235, 210, 0.1)" }}
      />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    </main>
  );
}

/** List-style skeleton for leaderboard, gallery, team pages */
export function SkeletonList({ rows = 8 }: { rows?: number }) {
  return (
    <main className="max-w-4xl mx-auto px-6 py-10">
      <div
        className="h-8 w-40 rounded mb-8 animate-pulse"
        style={{ backgroundColor: "rgba(255, 235, 210, 0.1)" }}
      />
      <div className="space-y-3">
        {Array.from({ length: rows }).map((_, i) => (
          <div
            key={i}
            className="h-14 rounded-lg animate-pulse"
            style={{
              backgroundColor: "rgba(255, 235, 210, 0.04)",
              opacity: 1 - i * 0.08,
            }}
          />
        ))}
      </div>
    </main>
  );
}
