export default function Loading() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-8 w-60 rounded bg-gray-200" />
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-20 rounded bg-gray-100" />
        ))}
      </div>
    </div>
  );
}
