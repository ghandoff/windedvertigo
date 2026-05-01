export default function PlaydateDetailLoading() {
  return (
    <main className="min-h-screen px-6 py-16 max-w-3xl mx-auto">
      <div
        className="h-4 w-32 rounded mb-6 animate-pulse"
        style={{ backgroundColor: "rgba(39, 50, 72, 0.08)" }}
      />
      <div
        className="h-8 w-2/3 rounded mb-4 animate-pulse"
        style={{ backgroundColor: "rgba(39, 50, 72, 0.10)" }}
      />
      <div
        className="h-4 w-full rounded mb-8 animate-pulse"
        style={{ backgroundColor: "rgba(39, 50, 72, 0.06)" }}
      />
      <div
        className="rounded-xl border border-cadet/10 p-6 mb-8 animate-pulse"
        style={{ backgroundColor: "rgba(255, 235, 210, 0.15)" }}
      >
        <div
          className="h-4 w-24 rounded mb-4"
          style={{ backgroundColor: "rgba(39, 50, 72, 0.08)" }}
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="flex items-start gap-2.5">
              <div
                className="h-5 w-5 rounded"
                style={{ backgroundColor: "rgba(39, 50, 72, 0.06)" }}
              />
              <div className="flex-1 space-y-1.5">
                <div
                  className="h-3 w-16 rounded"
                  style={{ backgroundColor: "rgba(39, 50, 72, 0.05)" }}
                />
                <div
                  className="h-3 w-24 rounded"
                  style={{ backgroundColor: "rgba(39, 50, 72, 0.08)" }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
      <div
        className="rounded-xl border p-6 animate-pulse"
        style={{
          borderColor: "rgba(203, 120, 88, 0.15)",
          backgroundColor: "rgba(255, 235, 210, 0.08)",
        }}
      >
        <div
          className="h-4 w-40 rounded mb-3"
          style={{ backgroundColor: "rgba(39, 50, 72, 0.08)" }}
        />
        <div
          className="h-3 w-full rounded mb-2"
          style={{ backgroundColor: "rgba(39, 50, 72, 0.05)" }}
        />
        <div
          className="h-3 w-4/5 rounded"
          style={{ backgroundColor: "rgba(39, 50, 72, 0.05)" }}
        />
      </div>
    </main>
  );
}
