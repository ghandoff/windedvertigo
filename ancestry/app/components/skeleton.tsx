export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-muted ${className}`} />;
}

export function SkeletonPage({ title }: { title?: string }) {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border px-4 md:px-6 py-3">
        <div className="flex items-center gap-3">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-32 hidden sm:block" />
        </div>
      </header>
      <div className="mx-auto max-w-4xl px-4 md:px-6 py-5 md:py-8 space-y-6">
        {title && <Skeleton className="h-6 w-48" />}
        <Skeleton className="h-4 w-72" />
        <div className="space-y-3">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      </div>
    </div>
  );
}

export function SkeletonPersonPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border px-4 md:px-6 py-3">
        <div className="flex items-center gap-3">
          <Skeleton className="h-4 w-24" />
        </div>
      </header>
      <div className="mx-auto max-w-3xl px-4 md:px-6 py-5 md:py-8 space-y-6">
        <div className="flex items-start gap-4">
          <Skeleton className="h-16 w-16 rounded-full shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-7 w-48" />
            <Skeleton className="h-4 w-32" />
            <div className="flex gap-2 mt-2">
              <Skeleton className="h-7 w-16" />
              <Skeleton className="h-7 w-20" />
            </div>
          </div>
        </div>
        <Skeleton className="h-32 w-full rounded-lg" />
        <Skeleton className="h-48 w-full rounded-lg" />
        <Skeleton className="h-24 w-full rounded-lg" />
      </div>
    </div>
  );
}

export function SkeletonMainPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border px-4 md:px-6 py-3 md:py-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-5 w-28" />
          <div className="flex items-center gap-3">
            <Skeleton className="h-6 w-6 rounded" />
            <Skeleton className="h-4 w-24" />
          </div>
        </div>
      </header>
      <div className="flex h-[calc(100vh-57px)]">
        <aside className="hidden md:block w-72 border-r border-border p-4 space-y-4">
          <Skeleton className="h-8 w-full" />
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-6 w-full" />
            ))}
          </div>
        </aside>
        <main className="flex-1 flex items-center justify-center">
          <Skeleton className="h-64 w-64 rounded-lg" />
        </main>
      </div>
    </div>
  );
}
