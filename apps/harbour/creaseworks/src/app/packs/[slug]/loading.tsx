export default function PackDetailLoading() {
  return (
    <main className="min-h-screen px-6 py-16 max-w-4xl mx-auto">
      {/* back link */}
      <div
        className="h-4 w-28 rounded mb-6 animate-pulse"
        style={{ backgroundColor: "rgba(39, 50, 72, 0.08)" }}
      />

      {/* title */}
      <div
        className="h-8 w-2/3 rounded mb-2 animate-pulse"
        style={{ backgroundColor: "rgba(39, 50, 72, 0.10)" }}
      />

      {/* description */}
      <div
        className="h-4 w-full rounded mb-2 animate-pulse"
        style={{ backgroundColor: "rgba(39, 50, 72, 0.05)" }}
      />
      <div
        className="h-4 w-3/4 rounded mb-8 animate-pulse"
        style={{ backgroundColor: "rgba(39, 50, 72, 0.05)" }}
      />

      {/* section heading */}
      <div
        className="h-4 w-40 rounded mb-4 animate-pulse"
        style={{ backgroundColor: "rgba(39, 50, 72, 0.08)" }}
      />

      {/* playdate list items */}
      <div className="space-y-3">
        {[...Array(5)].map((_, i) => (
          <div
            key={i}
            className="rounded-xl border border-cadet/10 p-4 animate-pulse"
          >
            <div
              className="h-5 w-1/3 rounded mb-2"
              style={{ backgroundColor: "rgba(39, 50, 72, 0.08)" }}
            />
            <div
              className="h-3 w-2/3 rounded mb-2"
              style={{ backgroundColor: "rgba(39, 50, 72, 0.05)" }}
            />
            <div className="flex gap-2">
              <div
                className="h-5 w-16 rounded-full"
                style={{ backgroundColor: "rgba(255, 235, 210, 0.3)" }}
              />
              <div
                className="h-5 w-16 rounded-full"
                style={{ backgroundColor: "rgba(177, 80, 67, 0.08)" }}
              />
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
