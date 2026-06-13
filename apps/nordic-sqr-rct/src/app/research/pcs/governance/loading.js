export default function GovernanceLoading() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-8 animate-pulse">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <div className="h-6 w-72 bg-gray-200 rounded" />
          <div className="h-4 w-48 bg-gray-100 rounded" />
        </div>
        <div className="h-7 w-28 bg-gray-100 rounded-full" />
      </div>
      <div className="rounded-xl border border-gray-100 bg-gray-50 h-40" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="rounded-lg border border-gray-100 bg-gray-50 h-24" />
        ))}
      </div>
      <div className="space-y-3">
        <div className="h-5 w-32 bg-gray-200 rounded" />
        {[0, 1].map((i) => (
          <div key={i} className="rounded-lg border border-gray-100 bg-gray-50 h-20" />
        ))}
      </div>
    </div>
  );
}
