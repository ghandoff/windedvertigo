export default function ExploreLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Header */}
      <div className="h-8 bg-gray-200 rounded w-64" />
      <div className="h-4 bg-gray-100 rounded w-96" />

      {/* Lens tabs */}
      <div className="flex gap-2">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-9 bg-gray-200 rounded-full w-36" />
        ))}
      </div>

      {/* Select */}
      <div className="h-10 bg-gray-200 rounded w-80" />

      {/* Results table skeleton */}
      <div className="rounded-lg border border-gray-200 overflow-hidden">
        <div className="h-10 bg-gray-100 w-full" />
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i} className="h-12 bg-white border-t border-gray-100 flex items-center px-4 gap-4">
            <div className="h-3 bg-gray-200 rounded w-48" />
            <div className="h-3 bg-gray-100 rounded w-24" />
            <div className="h-3 bg-gray-100 rounded w-20" />
            <div className="h-3 bg-gray-100 rounded w-16" />
            <div className="h-5 bg-gray-200 rounded-full w-24" />
          </div>
        ))}
      </div>
    </div>
  );
}
