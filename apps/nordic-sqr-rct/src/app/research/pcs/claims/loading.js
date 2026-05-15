export default function Loading() {
  return (
    <div className="space-y-4 animate-pulse">
      {/* Title */}
      <div className="h-8 w-56 rounded bg-gray-200" />
      {/* Banner placeholder (review queue / filter banner) */}
      <div className="h-12 rounded-lg bg-pacific-50/40 border border-pacific-100" />
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
