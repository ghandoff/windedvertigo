export default function Loading() {
  return (
    <div className="space-y-4 animate-pulse">
      {/* Title + subhead */}
      <div className="space-y-1">
        <div className="h-8 w-60 rounded bg-gray-200" />
        <div className="h-4 w-3/4 max-w-2xl rounded bg-gray-100" />
      </div>
      {/* Filter row — search input + category select + count */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="h-9 w-64 rounded-md bg-gray-100 border border-gray-200" />
        <div className="h-9 w-40 rounded-md bg-gray-100 border border-gray-200" />
        <div className="h-3 w-20 rounded bg-gray-100 ml-auto" />
      </div>
      {/* Table */}
      <div className="rounded-lg border border-gray-200 overflow-hidden">
        <div className="h-9 bg-gray-100 border-b border-gray-200" />
        <div className="divide-y divide-gray-100">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-11 bg-white" />
          ))}
        </div>
      </div>
    </div>
  );
}
