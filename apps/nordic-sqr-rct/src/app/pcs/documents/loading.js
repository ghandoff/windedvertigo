export default function Loading() {
  return (
    <div className="space-y-4 animate-pulse">
      {/* Title */}
      <div className="space-y-1">
        <div className="h-8 w-64 rounded bg-gray-200" />
        <div className="h-4 w-96 rounded bg-gray-100" />
      </div>
      {/* 6-card stat strip */}
      <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-16 rounded-lg border border-gray-200 bg-white">
            <div className="m-2 h-3 w-12 rounded bg-gray-100" />
            <div className="m-2 h-5 w-8 rounded bg-gray-200" />
          </div>
        ))}
      </div>
      {/* Table */}
      <div className="rounded-lg border border-gray-200 overflow-hidden">
        <div className="h-9 bg-gray-100 border-b border-gray-200" />
        <div className="divide-y divide-gray-100">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="h-11 bg-white" />
          ))}
        </div>
      </div>
    </div>
  );
}
