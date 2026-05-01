/**
 * Shared loading skeleton for all /matcher/* routes.
 *
 * When switching between find modes (classic ↔ rooms ↔ challenge ↔ hunt),
 * Next.js fetches the new RSC payload (force-dynamic). Without a
 * structural match here, the old page unmounts → generic skeleton
 * mismatch → perceived flash.
 *
 * This skeleton mirrors the actual page structure: back link → hero
 * (with fixed minHeight) → 4-col mode selector → content area.
 * Because it matches the real layout 1:1, the transition feels like
 * a smooth content swap rather than a page reload.
 */

export default function MatcherLoading() {
  return (
    <main className="px-4 pt-8 pb-24 sm:px-6 sm:pt-14 sm:pb-16">
      {/* ── header zone — same as real pages ── */}
      <div className="max-w-2xl mx-auto">
        {/* back link placeholder */}
        <div
          className="h-4 w-28 rounded mb-5 sm:mb-7"
          style={{ backgroundColor: "rgba(39, 50, 72, 0.06)" }}
        />

        {/* hero heading — matches minHeight: 152 */}
        <div className="relative mb-6 sm:mb-8" style={{ minHeight: 152 }}>
          <div
            className="h-9 w-72 rounded-lg mb-3"
            style={{ backgroundColor: "rgba(39, 50, 72, 0.06)" }}
          />
          <div
            className="h-5 w-96 max-w-full rounded mb-2"
            style={{ backgroundColor: "rgba(39, 50, 72, 0.04)" }}
          />
          <div
            className="h-5 w-64 rounded"
            style={{ backgroundColor: "rgba(39, 50, 72, 0.04)" }}
          />
        </div>

        {/* mode selector — 2×2 / 4-col grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-6">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="rounded-xl h-16 sm:h-20"
              style={{
                backgroundColor: "rgba(39, 50, 72, 0.06)",
                border: "1.5px solid rgba(39, 50, 72, 0.08)",
              }}
            />
          ))}
        </div>
      </div>

      {/* content area shimmer */}
      <div className="max-w-5xl mx-auto">
        <div
          className="h-64 rounded-2xl animate-pulse"
          style={{ backgroundColor: "rgba(39, 50, 72, 0.04)" }}
        />
      </div>
    </main>
  );
}
