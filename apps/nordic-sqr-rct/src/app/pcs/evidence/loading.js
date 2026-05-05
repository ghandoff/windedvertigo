export default function Loading() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-8 w-72 rounded bg-gray-200" />
      <div className="space-y-2">
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="h-10 rounded bg-gray-100" />
        ))}
      </div>
    </div>
  );
}
