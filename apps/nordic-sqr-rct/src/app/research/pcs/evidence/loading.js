export default function Loading() {
  return (
    <div className="space-y-4 animate-pulse">
      {/* Title */}
      <div className="h-8 w-72 rounded bg-gray-200" />
      {/* Search panel placeholder — matches the real page's search/filter card */}
      <div className="h-32 rounded-lg bg-gray-100 border border-gray-200" />
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
