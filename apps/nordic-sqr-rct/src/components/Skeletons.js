'use client';

export function CardSkeleton() {
  return (
    <div className="card p-6 animate-pulse">
      <div className="skeleton h-4 w-24 rounded mb-3" />
      <div className="skeleton h-10 w-20 rounded mb-2" />
      <div className="skeleton h-3 w-16 rounded" />
    </div>
  );
}

export function TableRowSkeleton({ count = 5 }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 py-3 border-b border-gray-100 animate-pulse">
          <div className="skeleton h-4 flex-1 rounded" />
          <div className="skeleton h-4 w-16 rounded" />
          <div className="skeleton h-6 w-20 rounded-full" />
          <div className="skeleton h-4 w-24 rounded" />
        </div>
      ))}
    </>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome */}
        <div className="mb-8 animate-pulse">
          <div className="skeleton h-8 w-64 rounded mb-2" />
          <div className="skeleton h-4 w-40 rounded" />
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </div>

        {/* Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Recent Reviews */}
          <div className="card p-6">
            <div className="skeleton h-6 w-40 rounded mb-6 animate-pulse" />
            <div className="space-y-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="border border-gray-100 rounded-lg p-4 animate-pulse">
                  <div className="flex justify-between items-start mb-2">
                    <div className="skeleton h-4 flex-1 rounded mr-4" />
                    <div className="skeleton h-6 w-16 rounded-full" />
                  </div>
                  <div className="flex justify-between mt-3">
                    <div className="skeleton h-4 w-20 rounded" />
                    <div className="skeleton h-4 w-24 rounded" />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Articles */}
          <div className="card p-6">
            <div className="skeleton h-6 w-48 rounded mb-2 animate-pulse" />
            <div className="skeleton h-4 w-72 rounded mb-6 animate-pulse" />
            <div className="space-y-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="border border-gray-100 rounded-lg p-4 animate-pulse">
                  <div className="skeleton h-4 w-full rounded mb-2" />
                  <div className="skeleton h-3 w-32 rounded mb-3" />
                  <div className="flex justify-between items-center">
                    <div className="skeleton h-6 w-28 rounded-full" />
                    <div className="skeleton h-8 w-24 rounded" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function FormSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i}>
          <div className="skeleton h-4 w-32 rounded mb-2" />
          <div className="skeleton h-10 w-full rounded" />
        </div>
      ))}
    </div>
  );
}

export function ListSkeleton({ count = 5 }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="card p-4 animate-pulse">
          <div className="flex items-center gap-4">
            <div className="skeleton h-10 w-10 rounded-full flex-shrink-0" />
            <div className="flex-1">
              <div className="skeleton h-4 w-48 rounded mb-2" />
              <div className="skeleton h-3 w-32 rounded" />
            </div>
            <div className="skeleton h-8 w-20 rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}
